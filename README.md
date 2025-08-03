# Story Collection - AI Agents for Capturing Life Stories

A web application that helps elderly users share their life stories through conversational AI, featuring two specialized agents that work together to capture and organize memories.

## Features

### 🤝 Collaborator Agent
- Empathetic conversation facilitator
- Asks thoughtful follow-up questions about family, childhood memories, and life events
- Maintains warm, conversational tone optimized for elderly users

### 🧠 Memory Keeper Agent
- Real-time extraction of structured data from conversations
- Organizes memories into categories: People, Dates, Places, Relationships, Events
- Provides visual feedback on captured information

### 🎨 User Interface
- Clean, accessible chat interface adapted from Memorial Mosaic design
- Large text and high contrast for elderly users
- Toggle switches for agent metadata and memory display
- Mobile-responsive design
- Export functionality for stories and extracted memories

## Technology Stack

- **Frontend**: Vanilla JavaScript, Custom CSS with CSS Custom Properties
- **AI Backend**: Anthropic Claude 3.5 Sonnet
- **Deployment**: Netlify (static hosting)
- **Architecture**: Event-driven, client-side application

## Quick Start

### Local Development

1. **Prerequisites**
   - Node.js 18+ (recommended: use nvm with `.nvmrc`)
   - Anthropic API key

2. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vibe-agents
   ```

3. **Environment Setup**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env and add your Anthropic API key:
   # ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

4. **Install Dependencies**
   ```bash
   npm install
   ```

5. **Start Development Server**
   ```bash
   # Option 1: Use development script (recommended)
   ./scripts/dev.sh
   
   # Option 2: Direct npm command
   npm start
   ```

6. **Access Application**
   ```
   http://localhost:3000
   ```

### Environment Management

**Node.js Isolation**: This project uses nvm for Node.js version management to avoid conflicts with other development projects.

**Node.js Version**: 18+ (specified in `.nvmrc`)
```bash
# Recommended: Use nvm for version isolation
nvm use          # Use project-specific version
nvm install      # Install if version not available
```

**Project Setup**: Run the setup script for complete environment isolation
```bash
./scripts/setup.sh   # One-time setup
./scripts/dev.sh     # Daily development
```

**Environment Variables**: All configuration in `.env` file
- `ANTHROPIC_API_KEY` - Required for AI agents
- `NODE_ENV` - development/production  
- `PORT` - Server port (default: 3000)

**Isolation Benefits**:
- Project-specific Node.js version
- Isolated npm dependencies
- No interference with other projects
- Clean environment setup/teardown

### Netlify Deployment

1. **Connect repository to Netlify**
   - Fork/clone this repository
   - Connect to Netlify dashboard

2. **Set environment variables**
   - In Netlify dashboard: Site settings → Environment variables
   - Add `ANTHROPIC_API_KEY` with your API key

3. **Deploy**
   - Netlify will automatically deploy from your repository
   - No build process needed - static files only

## Usage

1. **Start a Story Session**
   - Click "Start Sharing Your Story" on the welcome screen
   - The Collaborator agent will introduce itself and ask an opening question

2. **Share Your Stories**
   - Type responses in the chat interface
   - The Memory Keeper automatically extracts and organizes key information
   - Toggle agent details and memory display using the header switches

3. **Export Your Session**
   - Click "Export" to download your conversation and extracted memories as JSON
   - Includes timestamp, all messages, and organized memory data

## Configuration

### Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional
NODE_ENV=development
LOG_LEVEL=info
ENABLE_ANALYTICS=false
```

### Customization

- **Colors**: Modify CSS custom properties in `css/styles.css`
- **Agent Prompts**: Update system prompts in `js/app.js` (TODO: Move to Claude API integration)
- **Memory Categories**: Adjust categories in the memory extraction logic

## Development Roadmap

### Phase 1 (Current)
- [x] Basic UI with mosaic-inspired design
- [x] Simulated agent interactions
- [x] Memory extraction with keyword detection
- [x] Export functionality
- [ ] **Claude API integration for Collaborator agent**
- [ ] **Claude API integration for Memory Keeper agent**

### Phase 2 (Planned)
- [ ] Voice input support
- [ ] Enhanced memory visualization
- [ ] Session persistence and history
- [ ] Multi-language support
- [ ] Advanced export formats (PDF, Word)

### Phase 3 (Future)
- [ ] Context Enrichment Agent (photo/ancestry integration)
- [ ] Memory Assessment Agent (healthcare integration)
- [ ] Family sharing and collaboration features
- [ ] Advanced analytics and insights

## API Integration

### Anthropic Claude Setup

The application uses Anthropic's Claude 3.5 Sonnet for both agents:

```javascript
// Example API call structure (to be implemented)
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01'
  },
  body: JSON.stringify({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: userMessage
      }
    ],
    system: collaboratorSystemPrompt
  })
});
```

## Security Considerations

- API keys are handled via environment variables
- Content Security Policy configured in `netlify.toml`
- No sensitive data stored client-side
- HTTPS enforced in production

## Accessibility Features

- Large, high-contrast text optimized for elderly users
- Keyboard navigation support
- Screen reader compatibility
- Mobile-responsive design
- Simple, intuitive interface

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with elderly user scenarios in mind
5. Submit a pull request

## License

[License information to be added]

## Support

For questions or support, please [create an issue](link-to-issues) or contact [contact information].

---

*Built with ❤️ for preserving and sharing life stories*
