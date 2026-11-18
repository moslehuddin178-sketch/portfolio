# syntax=docker/dockerfile:1

# ---- Build stage -------------------------------------------------------------
FROM golang:1.27-alpine AS build
WORKDIR /src

# Download modules first so this layer is cached when only source changes.
COPY go.mod ./
RUN go mod download

COPY . .

# Build metadata, passed in by CI so /api/v1/status reports the exact commit.
ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_TIME=unknown

# Static, stripped binary: no cgo, no libc, nothing to patch at runtime.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath \
      -ldflags "-s -w \
        -X portfolio-api/internal/buildinfo.Version=${VERSION} \
        -X portfolio-api/internal/buildinfo.Commit=${COMMIT} \
        -X portfolio-api/internal/buildinfo.BuildTime=${BUILD_TIME}" \
      -o /out/api ./cmd/api

# ---- Runtime stage -----------------------------------------------------------
# Distroless static: no shell, no package manager, runs as UID 65532 (nonroot).
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api

ENV PORT=8080 APP_ENV=production
EXPOSE 8080
USER nonroot:nonroot

# Used by `docker run` locally and in CI. Azure Container Apps uses its own
# probes configured on the container app instead.
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD ["/api", "healthcheck"]

ENTRYPOINT ["/api"]
