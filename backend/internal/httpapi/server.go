// Package httpapi implements the portfolio REST API.
//
// Endpoints:
//
//	GET /healthz          liveness check (not logged, to keep log volume and cost low)
//	GET /api/v1/status    build + runtime metadata (commit, revision, uptime)
//	GET /api/v1/projects  public GitHub repositories, cached in memory
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"runtime"
	"time"

	"portfolio-api/internal/buildinfo"
	"portfolio-api/internal/config"
	"portfolio-api/internal/github"
)

// RepoSource is satisfied by *github.Client; an interface keeps handlers testable.
type RepoSource interface {
	Repos(ctx context.Context) ([]github.Repo, time.Time, error)
	Username() string
}

// Deps are the handler dependencies.
type Deps struct {
	Config    config.Config
	Logger    *slog.Logger
	Repos     RepoSource // nil when GITHUB_USERNAME is not configured
	StartedAt time.Time
	Now       func() time.Time
}

// NewHandler builds the router with its middleware chain.
func NewHandler(d Deps) http.Handler {
	if d.Now == nil {
		d.Now = time.Now
	}
	if d.StartedAt.IsZero() {
		d.StartedAt = d.Now()
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/v1/status", d.status)
	mux.HandleFunc("GET /api/v1/projects", d.projects)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "not_found", "no such endpoint")
	})

	var h http.Handler = mux
	h = cors(d.Config.AllowedOrigins)(h)
	h = securityHeaders(h)
	h = requestLogger(d.Logger)(h)
	h = recoverer(d.Logger)(h)
	return h
}

type statusResponse struct {
	Service       string         `json:"service"`
	Version       string         `json:"version"`
	Commit        string         `json:"commit"`
	BuildTime     string         `json:"buildTime"`
	GoVersion     string         `json:"goVersion"`
	Environment   string         `json:"environment"`
	StartedAt     time.Time      `json:"startedAt"`
	UptimeSeconds int64          `json:"uptimeSeconds"`
	Runtime       config.Runtime `json:"runtime"`
	GitHub        githubStatus   `json:"github"`
}

type githubStatus struct {
	Configured    bool `json:"configured"`
	Authenticated bool `json:"authenticated"` // whether a token secret is present (never the token itself)
}

func (d Deps) status(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, statusResponse{
		Service:       "portfolio-api",
		Version:       buildinfo.Version,
		Commit:        buildinfo.Commit,
		BuildTime:     buildinfo.BuildTime,
		GoVersion:     runtime.Version(),
		Environment:   d.Config.Environment,
		StartedAt:     d.StartedAt.UTC(),
		UptimeSeconds: int64(d.Now().Sub(d.StartedAt).Seconds()),
		Runtime:       d.Config.Runtime,
		GitHub: githubStatus{
			Configured:    d.Repos != nil,
			Authenticated: d.Config.GitHubToken != "",
		},
	})
}

type projectsResponse struct {
	Username  string        `json:"username"`
	FetchedAt time.Time     `json:"fetchedAt"`
	Repos     []github.Repo `json:"repos"`
}

func (d Deps) projects(w http.ResponseWriter, r *http.Request) {
	if d.Repos == nil {
		writeError(w, http.StatusServiceUnavailable, "github_not_configured", "GITHUB_USERNAME is not set on the API")
		return
	}
	repos, fetchedAt, err := d.Repos.Repos(r.Context())
	if err != nil {
		d.Logger.Error("loading github repos", "error", err)
		status := http.StatusBadGateway
		if errors.Is(err, context.Canceled) {
			status = http.StatusServiceUnavailable
		}
		writeError(w, status, "upstream_unavailable", "could not load repositories from GitHub")
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=300")
	writeJSON(w, http.StatusOK, projectsResponse{Username: d.Repos.Username(), FetchedAt: fetchedAt.UTC(), Repos: repos})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"error": code, "message": message})
}
