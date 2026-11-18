package github

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

const sampleResponse = `[
  {"name":"older","description":"Older repo","html_url":"https://github.com/u/older","homepage":null,"language":"Go","stargazers_count":3,"topics":["go"],"pushed_at":"2026-01-01T00:00:00Z","fork":false,"archived":false,"private":false},
  {"name":"forked","description":null,"html_url":"https://github.com/u/forked","homepage":null,"language":null,"stargazers_count":0,"topics":[],"pushed_at":"2026-06-01T00:00:00Z","fork":true,"archived":false,"private":false},
  {"name":"archived","description":null,"html_url":"https://github.com/u/archived","homepage":null,"language":null,"stargazers_count":0,"topics":[],"pushed_at":"2026-06-01T00:00:00Z","fork":false,"archived":true,"private":false},
  {"name":"newer","description":null,"html_url":"https://github.com/u/newer","homepage":"https://example.com","language":"TypeScript","stargazers_count":10,"pushed_at":"2026-05-01T00:00:00Z","fork":false,"archived":false,"private":false}
]`

func TestReposFiltersSortsAndAuthenticates(t *testing.T) {
	var gotAuth, gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth, gotPath = r.Header.Get("Authorization"), r.URL.Path
		_, _ = w.Write([]byte(sampleResponse))
	}))
	defer srv.Close()

	c := NewClient(Options{BaseURL: srv.URL, Username: "u", Token: "secret-token"})
	repos, _, err := c.Repos(context.Background())
	if err != nil {
		t.Fatalf("Repos: %v", err)
	}
	if gotAuth != "Bearer secret-token" {
		t.Errorf("Authorization header = %q", gotAuth)
	}
	if gotPath != "/users/u/repos" {
		t.Errorf("path = %q", gotPath)
	}
	if len(repos) != 2 || repos[0].Name != "newer" || repos[1].Name != "older" {
		t.Fatalf("unexpected repos: %+v", repos)
	}
	if repos[0].Topics == nil {
		t.Error("Topics should be an empty slice, not nil, so it serialises as []")
	}
}

func TestReposCachesAndServesStaleOnError(t *testing.T) {
	var calls atomic.Int32
	var fail atomic.Bool
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if fail.Load() {
			w.WriteHeader(http.StatusForbidden)
			return
		}
		_, _ = w.Write([]byte(sampleResponse))
	}))
	defer srv.Close()

	now := time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)
	c := NewClient(Options{BaseURL: srv.URL, Username: "u", CacheTTL: time.Minute})
	c.now = func() time.Time { return now }

	for range 3 {
		if _, _, err := c.Repos(context.Background()); err != nil {
			t.Fatalf("Repos: %v", err)
		}
	}
	if calls.Load() != 1 {
		t.Fatalf("expected 1 upstream call while cache is fresh, got %d", calls.Load())
	}

	now = now.Add(2 * time.Minute) // cache expired
	fail.Store(true)
	repos, _, err := c.Repos(context.Background())
	if err != nil || len(repos) != 2 {
		t.Fatalf("expected stale cache on upstream failure, got repos=%d err=%v", len(repos), err)
	}
	if calls.Load() != 2 {
		t.Fatalf("expected a refresh attempt, got %d calls", calls.Load())
	}
}

func TestReposReturnsErrorWithoutCache(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	c := NewClient(Options{BaseURL: srv.URL, Username: "u"})
	if _, _, err := c.Repos(context.Background()); !errors.Is(err, ErrUpstream) {
		t.Fatalf("expected ErrUpstream, got %v", err)
	}
}
