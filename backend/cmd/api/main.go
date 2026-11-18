// Command api runs the portfolio REST API.
//
// Run `api healthcheck` to probe a running instance; the Docker HEALTHCHECK
// uses this because the distroless runtime image has no shell or curl.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"portfolio-api/internal/buildinfo"
	"portfolio-api/internal/config"
	"portfolio-api/internal/github"
	"portfolio-api/internal/httpapi"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(healthcheck())
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return fmt.Errorf("invalid configuration: %w", err)
	}

	deps := httpapi.Deps{Config: cfg, Logger: logger, StartedAt: time.Now()}
	if cfg.GitHubUsername != "" {
		deps.Repos = github.NewClient(github.Options{
			Username: cfg.GitHubUsername,
			Token:    cfg.GitHubToken,
			CacheTTL: cfg.GitHubCacheTTL,
			Logger:   logger,
		})
	}

	if len(cfg.AllowedOrigins) == 0 {
		logger.Warn("ALLOWED_ORIGINS is empty; browsers on other origins will be blocked by CORS")
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           httpapi.NewHandler(deps),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    64 << 10,
	}

	// Azure Container Apps sends SIGTERM before stopping a replica (scale-in or
	// a new revision); shutting down gracefully lets in-flight requests finish.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errCh := make(chan error, 1)
	go func() {
		logger.Info("listening",
			"port", cfg.Port,
			"environment", cfg.Environment,
			"version", buildinfo.Version,
			"commit", buildinfo.Commit,
			"allowedOrigins", cfg.AllowedOrigins,
			"githubUsername", cfg.GitHubUsername,
			"githubTokenSet", cfg.GitHubToken != "", // log presence only, never the value
		)
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		logger.Info("shutting down")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func healthcheck() int {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	client := http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://127.0.0.1:" + port + "/healthz")
	if err != nil {
		fmt.Fprintln(os.Stderr, "healthcheck:", err)
		return 1
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		fmt.Fprintln(os.Stderr, "healthcheck: status", resp.StatusCode)
		return 1
	}
	return 0
}
