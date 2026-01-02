//! Complete example demonstrating Hikari SSR with Axum integration.
//!
//! This example shows:
//! - Setting up an SSR server
//! - Adding custom API routes
//! - Serving static assets
//! - Managing application state
//! - Error handling
//!
//! Run with:
//! ```bash
//! cargo run --example ssr_example
//! ```

use axum::{
    response::{Html, Json},
    routing::get,
};
use hikari_render_service::HikariRenderServicePlugin;
use serde::{Deserialize, Serialize};
use tokio::net::TcpListener;

/// Data structures for the example API
#[derive(Debug, Clone, Serialize, Deserialize)]
struct User {
    id: u32,
    name: String,
    email: String,
}

/// Handler functions
async fn index() -> Html<&'static str> {
    Html(
        r#"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hikari SSR Example</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        h1 { color: #333; }
        .card { border: 1px solid #ddd; padding: 20px; margin: 10px 0; border-radius: 8px; }
    </style>
</head>
<body>
    <h1>Welcome to Hikari SSR!</h1>
    <p>This is a server-side rendered page using Hikari and Axum.</p>

    <h2>Available Endpoints:</h2>
    <div class="card">
        <h3>GET /health</h3>
        <p>Health check endpoint</p>
    </div>
    <div class="card">
        <h3>GET /api/users</h3>
        <p>List all users</p>
    </div>
    <div class="card">
        <h3>POST /api/users</h3>
        <p>Create a new user (JSON body required)</p>
    </div>

    <script>
        // Example: Fetch users from the API
        fetch('/api/users')
            .then(res => res.json())
            .then(users => console.log('Users:', users))
            .catch(err => console.error('Error:', err));
    </script>
</body>
</html>
    "#,
    )
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "service": "hikari-render-service",
        "version": "0.1.0"
    }))
}

async fn get_users() -> Json<Vec<User>> {
    // Return mock users for now
    Json(vec![
        User {
            id: 1,
            name: "Alice".to_string(),
            email: "alice@example.com".to_string(),
        },
        User {
            id: 2,
            name: "Bob".to_string(),
            email: "bob@example.com".to_string(),
        },
    ])
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Using HikariRenderServicePlugin builder (recommended)
    let app = HikariRenderServicePlugin::new()
        .add_route("/", get(index))
        .add_route("/health", get(health))
        .add_route("/api/users", get(get_users))
        .static_assets("./dist")
        .build()?;

    // Start the server
    let addr = "0.0.0.0:3000";
    let listener = TcpListener::bind(addr).await?;

    println!("🚀 Hikari Render Service Example Server");
    println!("📡 Listening on http://{}\n", addr);
    println!("Endpoints:");
    println!("  - GET  /           - Home page");
    println!("  - GET  /health     - Health check");
    println!("  - GET  /api/users  - List users");
    println!("\nPress Ctrl+C to stop\n");

    axum::serve(listener, app).await?;

    Ok(())
}
