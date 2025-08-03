#!/bin/bash

# Development startup script for Story Collection
# Ensures proper Node.js environment isolation and dependencies

echo "🚀 Starting Story Collection Development Environment"
echo "📁 Project: $(basename $(pwd))"
echo "📂 Directory: $(pwd)"
echo ""

# Check if nvm is available
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    echo "📦 Loading nvm..."
    source "$HOME/.nvm/nvm.sh"
    
    # Use project-specific Node.js version if .nvmrc exists
    if [ -f ".nvmrc" ]; then
        echo "🔧 Using Node.js version from .nvmrc"
        nvm use
        if [ $? -ne 0 ]; then
            echo "📥 Installing required Node.js version..."
            nvm install
            nvm use
        fi
    fi
else
    echo "⚠️  nvm not found - using system Node.js"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Recommended: Install nvm and run 'nvm install 18'"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if ! node -e "process.exit(process.version.slice(1).split('.').map(Number).reduce((a,b,i)=>a+(b<<(8*(2-i))),0) >= '$REQUIRED_VERSION'.split('.').map(Number).reduce((a,b,i)=>a+(b<<(8*(2-i))),0) ? 0 : 1)"; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $NODE_VERSION"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create one based on .env.example"
    echo "   cp .env.example .env"
    echo "   # Then edit .env with your Anthropic API key"
    exit 1
fi

# Check if API key is configured
if ! grep -q "ANTHROPIC_API_KEY=" .env || grep -q "ANTHROPIC_API_KEY=$" .env; then
    echo "❌ ANTHROPIC_API_KEY not configured in .env"
    echo "   Please add your Anthropic API key to .env file"
    exit 1
else
    echo "✅ API key configured"
fi

echo "✅ Environment variables configured"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

echo "✅ Dependencies installed"

# Test Anthropic API connection BEFORE starting server
echo "🔍 Testing Anthropic API connection..."
node scripts/test-anthropic.js
if [ $? -ne 0 ]; then
    echo "❌ Anthropic API test failed. Please fix the API key before starting the server."
    echo ""
    echo "📋 Troubleshooting steps:"
    echo "   1. Check your Anthropic Console: https://console.anthropic.com/"
    echo "   2. Verify your API key is active and has Claude access"
    echo "   3. Generate a new API key if needed"
    echo "   4. Update .env with the correct key"
    echo "   5. Run this script again"
    exit 1
fi

echo "🎉 Anthropic API connection verified!"

# Start the development server
echo "🌐 Starting server on http://localhost:3000"
echo "📝 Environment: development"
echo "🤖 Anthropic API: Configured"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm start
