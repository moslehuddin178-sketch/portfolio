package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"portfolio-api/internal/config"
	"portfolio-api/internal/github"
)

type fakeRepos struct {
	repos []github.Repo
	err   error
}

func (f fakeRepos) Repos(context.Context) ([]github.Repo, time.Time, error) {
	return f.repos, time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC), f.err
}
func (f fakeRepos) Username() string { return "octocat" }

func newTestHandler(repos RepoSource) http.Handler {
	start := time.Date(2026, 11, 1, 0, 0, 0, 0, time.UTC)
	return NewHandler(Deps{
		Config: config.Config{
			Environment:    "test",
			AllowedOrigins: []string{"https://www.example.com"},
			GitHubToken:    "do-not-leak",
			Runtime:        config.Runtime{ContainerApp: "ca-portfolio-api", Revision: "ca-portfolio-api--r1"},
		},
		Logger:    slog.New(slog.DiscardHandler),
		Repos:     repos,
		StartedAt: start,
		Now:       func() time.Time { return start.Add(90 * time.Second) },
	})
}

func do(h http.Handler, method, path string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHealthz(t *testing.T) {
	rec := do(newTestHandler(nil), http.MethodGet, "/healthz", nil)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"ok"`) {
		t.Fatalf("got %d %s", rec.Code, rec.Body)
	}
	if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Error("missing security headers")
	}
}

func TestStatusReportsRuntimeWithoutSecrets(t *testing.T) {
	rec := do(newTestHandler(fakeRepos{}), http.MethodGet, "/api/v1/status", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status code %d", rec.Code)
	}
	body := rec.Body.String()
	if strings.Contains(body, "do-not-leak") {
		t.Fatal("status response leaked the GitHub token")
	}
	var got statusResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.UptimeSeconds != 90 || got.Runtime.Revision != "ca-portfolio-api--r1" ||
		!got.GitHub.Configured || !got.GitHub.Authenticated {
		t.Fatalf("unexpected status: %+v", got)
	}
}

func TestCORS(t *testing.T) {
	h := newTestHandler(nil)

	rec := do(h, http.MethodGet, "/api/v1/status", map[string]string{"Origin": "https://www.example.com"})
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "https://www.example.com" {
		t.Errorf("allowed origin: ACAO = %q", got)
	}

	rec = do(h, http.MethodGet, "/api/v1/status", map[string]string{"Origin": "https://evil.example"})
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("disallowed origin: ACAO = %q, want empty", got)
	}

	rec = do(h, http.MethodOptions, "/api/v1/projects", map[string]string{
		"Origin":                        "https://www.example.com",
		"Access-Control-Request-Method": "GET",
	})
	if rec.Code != http.StatusNoContent || rec.Header().Get("Access-Control-Allow-Methods") == "" {
		t.Errorf("preflight: got %d, headers %v", rec.Code, rec.Header())
	}
}

func TestProjects(t *testing.T) {
	t.Run("not configured", func(t *testing.T) {
		rec := do(newTestHandler(nil), http.MethodGet, "/api/v1/projects", nil)
		if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "github_not_configured") {
			t.Fatalf("got %d %s", rec.Code, rec.Body)
		}
	})
	t.Run("upstream failure", func(t *testing.T) {
		rec := do(newTestHandler(fakeRepos{err: errors.New("boom")}), http.MethodGet, "/api/v1/projects", nil)
		if rec.Code != http.StatusBadGateway {
			t.Fatalf("got %d", rec.Code)
		}
	})
	t.Run("success", func(t *testing.T) {
		repos := fakeRepos{repos: []github.Repo{{Name: "portfolio", Topics: []string{}}}}
		rec := do(newTestHandler(repos), http.MethodGet, "/api/v1/projects", nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("got %d", rec.Code)
		}
		var got projectsResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
			t.Fatal(err)
		}
		if got.Username != "octocat" || len(got.Repos) != 1 || got.Repos[0].Name != "portfolio" {
			t.Fatalf("unexpected body: %+v", got)
		}
	})
}

func TestUnknownRouteReturnsJSON404(t *testing.T) {
	rec := do(newTestHandler(nil), http.MethodGet, "/nope", nil)
	if rec.Code != http.StatusNotFound || !strings.HasPrefix(rec.Header().Get("Content-Type"), "application/json") {
		t.Fatalf("got %d %q", rec.Code, rec.Header().Get("Content-Type"))
	}
}

func TestRecovererReturns500(t *testing.T) {
	h := recoverer(slog.New(slog.DiscardHandler))(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("kaboom")
	}))
	rec := do(h, http.MethodGet, "/", nil)
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("got %d", rec.Code)
	}
}
