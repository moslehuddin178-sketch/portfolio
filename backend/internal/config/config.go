// Package config loads runtime configuration from environment variables.
//
// Nothing secret is ever hard-coded: secrets such as GITHUB_TOKEN are injected
// at runtime by Azure Container Apps (as a secret reference) or by the local
// shell during development.
package config

import (
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Config is the fully validated runtime configuration.
type Config struct {
	Port            string
	Environment     string
	AllowedOrigins  []string
	GitHubUsername  string
	GitHubToken     string // secret: never log this value
	GitHubCacheTTL  time.Duration
	ShutdownTimeout time.Duration
	Runtime         Runtime
}

// Runtime describes where the process is running. Azure Container Apps sets
// these variables automatically on every replica, which lets the API prove it
// is really running in Azure rather than claiming it.
type Runtime struct {
	ContainerApp string `json:"containerApp,omitempty"`
	Revision     string `json:"revision,omitempty"`
	Replica      string `json:"replica,omitempty"`
}

// githubUsernamePattern matches GitHub's username rules (alphanumerics and
// single hyphens, max 39 chars). Validating it prevents path injection into
// the upstream GitHub API URL.
var githubUsernamePattern = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9]|-[A-Za-z0-9]){0,38}$`)

// Load reads configuration using getenv (os.Getenv in production; a map in tests).
func Load(getenv func(string) string) (Config, error) {
	cfg := Config{
		Port:            valueOr(getenv("PORT"), "8080"),
		Environment:     valueOr(getenv("APP_ENV"), "development"),
		GitHubUsername:  strings.TrimSpace(getenv("GITHUB_USERNAME")),
		GitHubToken:     strings.TrimSpace(getenv("GITHUB_TOKEN")),
		GitHubCacheTTL:  15 * time.Minute,
		ShutdownTimeout: 10 * time.Second,
		Runtime: Runtime{
			ContainerApp: getenv("CONTAINER_APP_NAME"),
			Revision:     getenv("CONTAINER_APP_REVISION"),
			Replica:      getenv("CONTAINER_APP_REPLICA_NAME"),
		},
	}

	if p, err := strconv.Atoi(cfg.Port); err != nil || p < 1 || p > 65535 {
		return Config{}, fmt.Errorf("PORT must be a number between 1 and 65535, got %q", cfg.Port)
	}

	origins, err := parseOrigins(getenv("ALLOWED_ORIGINS"))
	if err != nil {
		return Config{}, err
	}
	cfg.AllowedOrigins = origins

	if cfg.GitHubUsername != "" && (len(cfg.GitHubUsername) > 39 || !githubUsernamePattern.MatchString(cfg.GitHubUsername)) {
		return Config{}, fmt.Errorf("GITHUB_USERNAME %q is not a valid GitHub username", cfg.GitHubUsername)
	}

	if raw := getenv("GITHUB_CACHE_TTL"); raw != "" {
		ttl, err := time.ParseDuration(raw)
		if err != nil || ttl < time.Minute {
			return Config{}, fmt.Errorf("GITHUB_CACHE_TTL must be a duration of at least 1m, got %q", raw)
		}
		cfg.GitHubCacheTTL = ttl
	}

	return cfg, nil
}

// parseOrigins parses a comma-separated list of exact origins such as
// "https://www.example.com,https://example.azurestaticapps.net".
// Wildcards are rejected on purpose: the API only answers known frontends.
func parseOrigins(raw string) ([]string, error) {
	var origins []string
	for part := range strings.SplitSeq(raw, ",") {
		o := strings.TrimRight(strings.TrimSpace(part), "/")
		if o == "" {
			continue
		}
		u, err := url.Parse(o)
		if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" ||
			u.Path != "" || u.RawQuery != "" || u.Fragment != "" || strings.Contains(o, "*") {
			return nil, fmt.Errorf("ALLOWED_ORIGINS entry %q must be an exact origin like https://www.example.com", part)
		}
		origins = append(origins, u.Scheme+"://"+u.Host)
	}
	return origins, nil
}

func valueOr(v, fallback string) string {
	if v = strings.TrimSpace(v); v != "" {
		return v
	}
	return fallback
}
