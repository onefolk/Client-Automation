# ==============================================================================
# OneFolk Client Intelligence - Rust Backend API Dockerfile (Railway & Production)
# ==============================================================================

# Build Stage
FROM rust:1.78-slim-bookworm as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace configuration and sources
COPY Cargo.toml Cargo.lock* ./
COPY crates ./crates
COPY backend ./backend
COPY workers ./workers

# Build release binary for the backend api service
RUN cargo build --release --bin api

# ------------------------------------------------------------------------------
# Runtime Stage
# ------------------------------------------------------------------------------
FROM debian:bookworm-slim

WORKDIR /app

# Install SSL and network certificates
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary from builder
COPY --from=builder /app/target/release/api /usr/local/bin/onefolk-api

# Default environment
ENV PORT=8080
ENV RUST_LOG=info
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Start the API server
CMD ["onefolk-api"]
