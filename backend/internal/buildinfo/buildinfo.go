// Package buildinfo exposes metadata stamped into the binary at build time.
//
// The values are injected by the Docker build (see backend/Dockerfile) with:
//
//	go build -ldflags "-X portfolio-api/internal/buildinfo.Commit=<sha> ..."
//
// so the running API can report exactly which commit it was built from.
package buildinfo

var (
	// Version is a human-readable version, e.g. the short commit SHA.
	Version = "dev"
	// Commit is the full Git commit SHA the binary was built from.
	Commit = "unknown"
	// BuildTime is the UTC RFC 3339 timestamp of the build.
	BuildTime = "unknown"
)
