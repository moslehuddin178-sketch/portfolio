// Package github fetches a user's public repositories from the GitHub REST API
// and caches them in memory, so visitor traffic never fans out to GitHub.
package github

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"sort"
	"sync"
	"time"
)

// Repo is the trimmed-down repository shape returned to the frontend.
type Repo struct {
	Name        string    `json:"name"`
	Description string    `json:"description"`
	URL         string    `json:"url"`
	Homepage    string    `json:"homepage,omitempty"`
	Language    string    `json:"language,omitempty"`
	Stars       int       `json:"stars"`
	Topics      []string  `json:"topics"`
	PushedAt    time.Time `json:"pushedAt"`
}

// Options configures a Client.
type Options struct {
	BaseURL    string // defaults to https://api.github.com
	Username   string
	Token      string // optional; raises the rate limit from 60 to 5,000 req/h
	CacheTTL   time.Duration
	MaxRepos   int
	HTTPClient *http.Client
	Logger     *slog.Logger
}

// Client is safe for concurrent use.
type Client struct {
	opts Options
	now  func() time.Time

	mu        sync.Mutex
	cached    []Repo
	fetchedAt time.Time
}

// NewClient returns a caching GitHub client.
func NewClient(opts Options) *Client {
	if opts.BaseURL == "" {
		opts.BaseURL = "https://api.github.com"
	}
	if opts.CacheTTL <= 0 {
		opts.CacheTTL = 15 * time.Minute
	}
	if opts.MaxRepos <= 0 {
		opts.MaxRepos = 12
	}
	if opts.HTTPClient == nil {
		opts.HTTPClient = &http.Client{Timeout: 10 * time.Second}
	}
	if opts.Logger == nil {
		opts.Logger = slog.New(slog.DiscardHandler)
	}
	return &Client{opts: opts, now: time.Now}
}

// Username returns the GitHub account this client reads from.
func (c *Client) Username() string { return c.opts.Username }

// Repos returns the cached repositories, refreshing them when the cache is
// older than CacheTTL. If GitHub is unavailable but an older copy exists, the
// stale copy is served instead of an error (stale-if-error).
func (c *Client) Repos(ctx context.Context) ([]Repo, time.Time, error) {
	c.mu.Lock()
	defer c.mu.Unlock() // holding the lock while fetching also prevents a thundering herd

	if c.cached != nil && c.now().Sub(c.fetchedAt) < c.opts.CacheTTL {
		return c.cached, c.fetchedAt, nil
	}

	repos, err := c.fetch(ctx)
	if err != nil {
		if c.cached != nil {
			c.opts.Logger.Warn("github fetch failed; serving stale cache", "error", err, "age", c.now().Sub(c.fetchedAt).String())
			return c.cached, c.fetchedAt, nil
		}
		return nil, time.Time{}, err
	}

	c.cached, c.fetchedAt = repos, c.now()
	return c.cached, c.fetchedAt, nil
}

type apiRepo struct {
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	HTMLURL     string    `json:"html_url"`
	Homepage    *string   `json:"homepage"`
	Language    *string   `json:"language"`
	Stars       int       `json:"stargazers_count"`
	Topics      []string  `json:"topics"`
	PushedAt    time.Time `json:"pushed_at"`
	Fork        bool      `json:"fork"`
	Archived    bool      `json:"archived"`
	Private     bool      `json:"private"`
}

// ErrUpstream is returned when GitHub answers with a non-200 status.
var ErrUpstream = errors.New("github upstream error")

func (c *Client) fetch(ctx context.Context) ([]Repo, error) {
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	endpoint := fmt.Sprintf("%s/users/%s/repos?type=owner&sort=pushed&per_page=100",
		c.opts.BaseURL, url.PathEscape(c.opts.Username))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "portfolio-api")
	if c.opts.Token != "" {
		req.Header.Set("Authorization", "Bearer "+c.opts.Token)
	}

	resp, err := c.opts.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("%w: status %d (rate limit remaining: %s)",
			ErrUpstream, resp.StatusCode, resp.Header.Get("X-RateLimit-Remaining"))
	}

	var raw []apiRepo
	if err := json.NewDecoder(io.LimitReader(resp.Body, 5<<20)).Decode(&raw); err != nil {
		return nil, fmt.Errorf("%w: decoding response: %v", ErrUpstream, err)
	}

	repos := make([]Repo, 0, len(raw))
	for _, r := range raw {
		if r.Fork || r.Archived || r.Private {
			continue
		}
		topics := r.Topics
		if topics == nil {
			topics = []string{}
		}
		repos = append(repos, Repo{
			Name:        r.Name,
			Description: deref(r.Description),
			URL:         r.HTMLURL,
			Homepage:    deref(r.Homepage),
			Language:    deref(r.Language),
			Stars:       r.Stars,
			Topics:      topics,
			PushedAt:    r.PushedAt,
		})
	}
	sort.SliceStable(repos, func(i, j int) bool { return repos[i].PushedAt.After(repos[j].PushedAt) })
	if len(repos) > c.opts.MaxRepos {
		repos = repos[:c.opts.MaxRepos]
	}
	return repos, nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
