//! Example SSR application demonstrating Hikari SSR usage.
//!
//! This example shows how to set up a complete SSR application with:
//! - Custom API routes
//! - Static asset serving
//! - State management
//! - Dioxus SSR integration
//!
//! Run this example with:
//! ```bash
//! cargo run --package hikari-ssr --example example
//! ```

use crate::router::{build_router, health_check};
use axum::{
    extract::State,
    response::{Html, IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;

/// User data for the example API.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct User {
    id: u32,
    name: String,
    email: String,
}

/// Application state shared across handlers.
#[derive(Clone, Debug)]
struct ExampleState {
    app_name: String,
    version: String,
    users: Vec<User>,
}

/// Simple "Hello World" handler.
async fn hello_handler() -> Html<&'static str> {
    Html("<h1>Hello, Hikari SSR!</h1><p>Welcome to the Hikari framework.</p>")
}

/// Get all users handler.
async fn get_users(State(state): State<ExampleState>) -> impl IntoResponse {
    Json(state.users)
}

/// Create a new user handler.
async fn create_user(
    State(mut state): State<ExampleState>,
    Json(user): Json<User>,
) -> impl IntoResponse {
    state.users.push(user.clone());
    Json(user)
}

/// Main entry point for the example application.
///
/// # Example
///
/// ```bash
/// cargo run --package hikari-ssr --example example
/// ```
pub async fn run_example() -> anyhow::Result<()> {
    // Initialize application state
    let example_state = ExampleState {
        app_name: "Hikari SSR Example".to_string(),
        version: "0.1.0".to_string(),
        users: vec![
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
        ],
    };

    // Build the router using the HikariSsrPlugin builder
    //
    // The builder provides a fluent API for configuring:
    // - Custom routes (API endpoints, handlers, etc.)
    // - Static asset serving (WASM, JS, CSS files)
    // - Application state (shared data across handlers)
    //
    // This sets up:
    // 1. A health check endpoint at /health
    // 2. A hello endpoint at /hello
    // 3. User API endpoints at /api/users
    // 4. Static assets served from ./dist
    // 5. Dioxus SSR routes at /ssr/*
    let mut state_map = HashMap::new();
    state_map.insert(
        "app_name".to_string(),
        serde_json::to_value(example_state.app_name).unwrap(),
    );
    state_map.insert(
        "version".to_string(),
        serde_json::to_value(example_state.version).unwrap(),
    );

    let app = build_router(
        vec![
            // Health check endpoint for monitoring and load balancers
            crate::plugin::RouterRoute {
                path: "/health".to_string(),
                method_router: get(health_check),
            },
            // Simple hello world page
            crate::plugin::RouterRoute {
                path: "/hello".to_string(),
                method_router: get(hello_handler),
            },
            // REST API for user management
            crate::plugin::RouterRoute {
                path: "/api/users".to_string(),
                method_router: get(get_users).post(create_user),
            },
        ],
        // Serve static assets from the dist directory
        // This is where your WASM, JS, and CSS files should be
        Some("./dist".into()),
        crate::static_files::StaticFileConfig::default(),
        state_map,
    )?;

    // Configure the server address
    // In production, you would typically read this from environment variables
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));

    println!("\n🚀 Hikari SSR Example Server");
    println!("📡 Server listening on http://{}\n", addr);
    println!("Available endpoints:");
    println!("  - GET  /health          - Health check");
    println!("  - GET  /hello           - Hello World page");
    println!("  - GET  /api/users       - List all users");
    println!("  - POST /api/users       - Create a new user");
    println!("  - GET  /assets/*        - Static assets");
    println!("  - GET  /ssr/*           - Dioxus SSR routes");
    println!("  - GET  /                - SSR home page\n");

    // Start the server
    // This will block until the server is shut down
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Example demonstrating how to use the HikariSsrPlugin builder directly.
///
/// This is equivalent to the build_router() call above but uses the
/// more ergonomic builder pattern.
pub async fn run_with_plugin_builder() -> anyhow::Result<()> {
    use crate::HikariSsrPlugin;

    // Create a new SSR plugin builder
    let app = HikariSsrPlugin::new()
        // Add custom routes
        .add_route("/health", get(health_check))
        .add_route("/hello", get(hello_handler))
        .add_route("/api/users", get(get_users).post(create_user))
        // Configure static assets
        .static_assets("./dist")
        // Add application state
        .state("app_name", "Hikari SSR Example")
        .state("version", "0.1.0")
        // Build the router
        .build()?;

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_hello_handler() {
        let response = hello_handler().await.into_response();
        assert_eq!(response.status(), axum::http::StatusCode::OK);
    }

    #[tokio::test]
    async fn test_example_state() {
        let state = ExampleState {
            app_name: "Test".to_string(),
            version: "1.0.0".to_string(),
            users: vec![],
        };

        assert_eq!(state.app_name, "Test");
        assert_eq!(state.version, "1.0.0");
        assert!(state.users.is_empty());
    }

    #[tokio::test]
    async fn test_user_serialization() {
        let user = User {
            id: 1,
            name: "Alice".to_string(),
            email: "alice@example.com".to_string(),
        };

        let json = serde_json::to_string(&user).unwrap();
        assert!(json.contains("Alice"));
        assert!(json.contains("alice@example.com"));
    }
}
