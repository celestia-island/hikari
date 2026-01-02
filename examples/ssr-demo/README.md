# SSR Demo

Server-Side Rendering demonstration using Hikari SSR with Axum.

## Features

This demo showcases:

- **Server-Side Rendering**: Full SSR with Dioxus
- **Static Asset Serving**: Efficient file serving with caching
- **Health Check Endpoints**: Monitoring and load balancer integration
- **API Routes**: RESTful API examples
- **CORS Support**: Cross-origin resource sharing
- **Compression**: Automatic response compression
- **Request Tracing**: Structured logging

## Running the Demo

This demo is a standalone workspace and requires building dependencies first.

```bash
# From this directory (recommended)
just run
```

Or manually:

```bash
# 1. Build workspace dependencies first
cd ../..
cargo build --workspace --bins

# 2. Build and run the demo
cd examples/ssr-demo
cargo run
```

The server will start on `http://localhost:3000`

Available commands (see `justfile`):

- `just run` - Build and run the demo
- `just build` - Build the demo only
- `just build-deps` - Build workspace dependencies
- `just clean` - Clean build artifacts
- `just check` - Run formatting and clippy checks

## Available Endpoints

### Web Interface

- `GET /` - Main HTML page (SSR rendered)

### API Endpoints

- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed health with system info
- `GET /api/info` - Service information and features

### Static Assets

- `/static/*` - Static files (JS, CSS, images, etc.)
- Configured with cache headers for performance

## Server Features

### Health Checks

Basic health check:

```bash
curl http://localhost:3000/api/health
```

Response:

```json
{
  "status": "healthy",
  "service": "hikari-ssr-demo",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

Detailed health check:

```bash
curl http://localhost:3000/api/health/detailed
```

### Static Asset Serving

Static files are served from the `./static` directory with:

- JavaScript/CSS files: 1 hour cache
- Images: 24 hour cache
- SPA fallback support
- Compression enabled

### CORS Configuration

CORS is configured permissively for development. In production, you should:

- Whitelist specific origins
- Configure allowed methods
- Set appropriate headers

### Compression

All responses are automatically compressed using gzip for:

- Reduced bandwidth usage
- Faster page loads
- Better user experience

### Request Tracing

All HTTP requests are logged with:

- Request method and path
- Response status code
- Request duration
- Structured JSON format

## Configuration

### Port

Change the port in `main.rs`:

```rust
let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
```

### Static Assets Configuration

Configure static asset serving:

```rust
.static_assets(StaticFileConfig {
    root_dir: "./dist".to_string(),
    cache_control: vec![
        (Duration::from_secs(3600), vec!["*.js", "*.css"]),
    ],
    spa_fallback: true,
})
```

### Custom Routes

Add custom API routes:

```rust
.add_route("/api/custom", get(custom_handler))
```

## Production Deployment

### Build for Release

```bash
cargo build --release --bin ssr-demo
```

### Environment Variables

- `RUST_LOG`: Set log level (e.g., `info`, `debug`)
- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: 0.0.0.0)

### Running in Production

```bash
RUST_LOG=info ./target/release/ssr-demo
```

### Reverse Proxy

Use nginx or similar as a reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release --bin ssr-demo

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates
COPY --from=builder /app/target/release/ssr-demo /usr/local/bin/
EXPOSE 3000
CMD ["ssr-demo"]
```

Build and run:

```bash
docker build -t hikari-ssr-demo .
docker run -p 3000:3000 hikari-ssr-demo
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Static Assets Not Loading

- Ensure the `./static` directory exists
- Check file permissions
- Verify the path in `StaticFileConfig`

### CORS Errors

- Check CORS configuration
- Verify allowed origins
- Check preflight requests

## Tech Stack

- **Dioxus 0.7**: Reactive UI framework
- **Axum 0.8**: Web framework
- **Tokio**: Async runtime
- **Tower**: Middleware stack
- **Hikari SSR**: SSR integration
- **Tracing**: Structured logging
