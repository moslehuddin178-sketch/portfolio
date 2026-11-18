package config

import (
	"reflect"
	"testing"
	"time"
)

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestLoadDefaults(t *testing.T) {
	cfg, err := Load(env(nil))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Port != "8080" || cfg.Environment != "development" {
		t.Errorf("unexpected defaults: port=%q env=%q", cfg.Port, cfg.Environment)
	}
	if cfg.GitHubCacheTTL != 15*time.Minute {
		t.Errorf("GitHubCacheTTL = %v, want 15m", cfg.GitHubCacheTTL)
	}
	if len(cfg.AllowedOrigins) != 0 {
		t.Errorf("AllowedOrigins = %v, want empty", cfg.AllowedOrigins)
	}
}

func TestLoadParsesOriginsAndRuntime(t *testing.T) {
	cfg, err := Load(env(map[string]string{
		"ALLOWED_ORIGINS":            " https://www.example.com/ , http://localhost:5173 ,",
		"CONTAINER_APP_NAME":         "ca-portfolio-api",
		"CONTAINER_APP_REVISION":     "ca-portfolio-api--abc123",
		"CONTAINER_APP_REPLICA_NAME": "replica-1",
		"GITHUB_USERNAME":            "octo-cat",
		"GITHUB_CACHE_TTL":           "5m",
	}))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	want := []string{"https://www.example.com", "http://localhost:5173"}
	if !reflect.DeepEqual(cfg.AllowedOrigins, want) {
		t.Errorf("AllowedOrigins = %v, want %v", cfg.AllowedOrigins, want)
	}
	if cfg.Runtime.Revision != "ca-portfolio-api--abc123" {
		t.Errorf("Runtime.Revision = %q", cfg.Runtime.Revision)
	}
	if cfg.GitHubCacheTTL != 5*time.Minute {
		t.Errorf("GitHubCacheTTL = %v", cfg.GitHubCacheTTL)
	}
}

func TestLoadRejectsInvalidValues(t *testing.T) {
	cases := map[string]map[string]string{
		"non-numeric port":    {"PORT": "http"},
		"port out of range":   {"PORT": "70000"},
		"wildcard origin":     {"ALLOWED_ORIGINS": "https://*.example.com"},
		"origin with path":    {"ALLOWED_ORIGINS": "https://example.com/app"},
		"origin no scheme":    {"ALLOWED_ORIGINS": "example.com"},
		"username traversal":  {"GITHUB_USERNAME": "../orgs/x"},
		"username too long":   {"GITHUB_USERNAME": "a234567890123456789012345678901234567890"},
		"cache ttl too short": {"GITHUB_CACHE_TTL": "10s"},
	}
	for name, vars := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := Load(env(vars)); err == nil {
				t.Fatalf("expected an error for %v", vars)
			}
		})
	}
}
