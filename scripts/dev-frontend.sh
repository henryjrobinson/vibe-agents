#!/bin/bash

# Frontend Development Server
echo "🎬 Starting frontend development server..."
echo "📁 Serving files from: $(pwd)"
echo "🌐 Frontend will be available at: http://localhost:8080"
echo "🔗 Backend API running at: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Use Python's built-in HTTP server (available on all systems)
if command -v python3 &> /dev/null; then
    python3 -m http.server 8080
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8080
else
    echo "❌ Python not found. Please install Python or use another HTTP server."
    exit 1
fi
