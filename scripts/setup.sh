#!/bin/bash

# Setup script for Story Collection project
# Creates isolated Node.js environment without affecting other projects

echo "🔧 Setting up Story Collection Project Environment"
echo "📁 Project: $(basename $(pwd))"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Please run this script from the project root."
    exit 1
fi

# Check if nvm is available
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    echo "📦 Loading nvm..."
    source "$HOME/.nvm/nvm.sh"
    
    # Install and use project-specific Node.js version
    if [ -f ".nvmrc" ]; then
        echo "🔧 Setting up Node.js version from .nvmrc"
        nvm install
        nvm use
        
        # Create .nvmrc-specific npm prefix to isolate global packages
        NODE_VERSION=$(cat .nvmrc)
        echo "📦 Node.js version: $NODE_VERSION isolated for this project"
    else
        echo "⚠️  .nvmrc not found, using default Node.js"
    fi
else
    echo "⚠️  nvm not found. Consider installing nvm for better Node.js version management:"
    echo "   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
fi

# Install project dependencies
echo "📥 Installing project dependencies..."
npm install

# Create .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your Anthropic API key:"
    echo "   ANTHROPIC_API_KEY=sk-ant-api03-..."
else
    echo "✅ .env file already exists"
fi

# Check if API key is configured
if ! grep -q "ANTHROPIC_API_KEY=" .env || grep -q "ANTHROPIC_API_KEY=$" .env; then
    echo "⚠️  ANTHROPIC_API_KEY not configured in .env"
    echo "   Please add your Anthropic API key to .env file"
else
    echo "✅ API key configured"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Edit .env with your Anthropic API key (if not done already)"
echo "   2. Run: ./scripts/dev.sh"
echo "   3. Open: http://localhost:3000"
echo ""
echo "💡 This setup isolates Node.js dependencies for this project only."
echo "   Your other development projects won't be affected."
