# Story Collection App - Comprehensive Project Roadmap

## 🎯 Project Overview

**Mission**: AI-powered story collection system helping elderly users share life stories through conversational AI with automated memory extraction and structured data preservation.

**Current Status**: ✅ Firebase authentication integrated, CSP hardened, fully functional prototype on Render

---

# 🏗️ Technical Architecture

### Current Stack
- **Frontend**: Vanilla JS with modern ES6+ features
- **Backend**: Express.js server with SSE streaming
- **Authentication**: Firebase Auth (client) + Firebase Admin SDK (server)
- **AI**: Anthropic Claude API with streaming responses
- **Hosting**: Render (single service for frontend + API)
- **Security**: Hardened CSP, token-based auth, user data isolation

### Agent Architecture
- **Collaborator Agent**: Empathetic conversation facilitator
- **Memory Keeper Agent**: Real-time structured data extraction
- **Tool System**: Extensible architecture for future agents

---

## 📈 Development Phases

### ✅ Phase 1: Core Infrastructure (COMPLETED)
- [x] Express server with SSE streaming
- [x] Firebase authentication integration
- [x] Protected API endpoints with user isolation
- [x] Memory extraction tool architecture
- [x] CSP hardening and security improvements
- [x] Render deployment configuration

### 🔄 Phase 2: Performance & UX (IN PROGRESS)
**Priority: High** | **Timeline: 1-2 weeks**

#### Performance Optimizations
- [ ] Switch to Claude 3.5 Haiku for faster responses (50-70% improvement)
- [ ] Implement parallel API calls (Memory Keeper + Collaborator)
- [ ] Add function warming to eliminate cold starts
- [ ] Reduce token limits: Memory Keeper 500→300, Collaborator 1000→500
- [ ] Implement streaming responses for better perceived performance
 - [ ] Experiment with model quality vs latency for Collaborator tone
   - [ ] A/B test `claude-3-5-sonnet-latest` vs Haiku for warmth/clarity
   - [ ] Explore Claude 4 variants if significantly better tone (accepting latency)

#### UX Improvements
- [ ] Enhanced error handling with retry logic
- [ ] Better loading states and progress indicators
- [x] Improved mobile responsiveness (header optimization, background fixes)
- [ ] **Mobile Hamburger Menu Implementation** (NEW - see detailed plan below)
- [ ] Voice interface support for accessibility
- [ ] Adjust chat window spacing (padding and subtle borders)
- [ ] Normalize button colors and restyle main chat page
- [ ] Fix header links (Pricing, Support, How it Works)
 - [x] Remove stage directions from Collaborator responses (write empathetically without bracketed actions)

#### Bug Fixes
- [ ] Fix duplicate memory extraction bug
- fix memory extractor login issue after login it says you need to log in but there is no problem it just doesn't refresh

#### Hardening (Phase 2)
- [ ] Upgrade Node.js runtime to active LTS on Render and locally
  - Update `.nvmrc` to Node 20.x (e.g., `20.14.0`) to replace EOL `18.19.0`
  - Verify Render picks up `.nvmrc` and redeploy
  - Keep `package.json -> engines.node` compatible (>=20)
- [ ] Replace escaped JSON env for Firebase Admin with a robust solution
  - Option A (recommended): Use Render Secret File + `GOOGLE_APPLICATION_CREDENTIALS`, and let `initializeFirebaseAdmin()` use Application Default Credentials in production
  - Option B: Add `FIREBASE_SERVICE_ACCOUNT_KEY_B64` support; store Base64-encoded JSON and decode before `JSON.parse`
  - Remove reliance on fragile newline-escaped JSON in `FIREBASE_SERVICE_ACCOUNT_KEY`


---

## 📱 Mobile Hamburger Menu Implementation Plan

**Priority: Medium** | **Complexity: Moderate Refactor** | **Timeline: 3-5 days**

### Overview
Replace current mobile header buttons with a hamburger menu and slide-out drawer for better mobile UX and space utilization.

### Technical Implementation Steps

#### 1. Create Hamburger Menu Component
- [ ] Add hamburger icon (three horizontal lines) to left side of mobile header
- [ ] Create CSS animations for hamburger → X transformation
- [ ] Position hamburger button with proper touch target size (44px minimum)

#### 2. Build Slide-Out Drawer
- [ ] Create full-viewport overlay drawer component
- [ ] Implement left-to-right slide animation using CSS transforms
- [ ] Add backdrop overlay with opacity transition
- [ ] Ensure drawer covers entire viewport (100vw × 100vh)

#### 3. Move Header Buttons to Drawer
- [ ] Relocate all current header buttons into drawer menu:
  - Create button
  - Reset button  
  - Export button
  - Model selector
  - User profile/logout
- [ ] Style buttons as vertical list with proper spacing
- [ ] Add icons and labels for better mobile UX

#### 4. Implement Drawer Functionality
- [ ] Add click handlers for hamburger open/close
- [ ] Implement backdrop click to close drawer
- [ ] Add keyboard support (ESC key to close)
- [ ] Prevent body scroll when drawer is open
- [ ] Add smooth slide animations (300ms duration)

#### 5. Update Mobile Responsive CSS
- [ ] Hide current mobile header buttons at mobile breakpoint
- [ ] Show hamburger menu only on mobile (<768px)
- [ ] Maintain desktop header functionality unchanged
- [ ] Add proper z-index layering for drawer

#### 6. JavaScript Integration
- [ ] Update `js/app-header.js` with drawer functionality
- [ ] Add event listeners for menu interactions
- [ ] Integrate with existing button functionality
- [ ] Ensure Firebase auth state updates work in drawer

### Files to Modify
- `css/styles.css` - Mobile responsive styles and animations
- `js/app-header.js` - Hamburger menu logic
- `index.html` / `chat.html` - Add hamburger button markup

### Benefits
- **Better Mobile UX**: Clean header with more space for content
- **Modern Design**: Industry-standard mobile navigation pattern
- **Improved Accessibility**: Larger touch targets and clearer navigation
- **Scalable**: Easy to add new menu items without header crowding

### Risks & Considerations
- **Moderate Refactor**: Requires changes to header component and CSS
- **Testing Required**: Need to verify on various mobile devices
- **Animation Performance**: Ensure smooth animations on older devices

---

### 🚀 Phase 3: Advanced Features (PLANNED)
**Priority: Medium** | **Timeline: 2-3 weeks**

#### Database & Persistence
- [x] Migrate from in-memory to PostgreSQL (COMPLETED - encrypted storage implemented)
- [x] Implement conversation history (COMPLETED - persistent across sessions)
- [ ] Add user preferences and settings
- [ ] Session management improvements

#### Advanced Memory Features
- [ ] Memory editing and correction UI
- [ ] Full-text search across memories
- [ ] Memory validation and cross-referencing
- [ ] Enhanced relationship inference and family tree building

#### Tool Ecosystem
- [ ] **Render Scene Tool**: Visual scene generation for memories
- [ ] **Photo Search Tool**: Google Photos integration
- [ ] **Context Enrichment**: Historical context and external data
- [ ] **Memory Assessment**: Cognitive pattern analysis for healthcare

### 🔮 Phase 4: Frontend Modernization (FUTURE)
**Priority: Low** | **Timeline: 3-4 weeks**

#### React Migration (Optional)
- [ ] Vite + React + TypeScript setup
- [ ] Component-based architecture
- [ ] Type-safe API integration
- [ ] Advanced state management
- [ ] Performance optimizations

*Note: Current vanilla JS implementation is working well - React migration is optional*

### 🏥 Phase 5: Healthcare Integration (FUTURE)
**Priority: TBD** | **Timeline: 4-6 weeks**

- [ ] HIPAA compliance implementation
- [ ] Healthcare provider dashboard
- [ ] Memory quality assessment algorithms
- [ ] Trend analysis and reporting
- [ ] Secure data transmission protocols

---

## 🛠️ Technical Priorities

### Immediate (Next 2 weeks)
1. **Performance**: Claude 3.5 Haiku + parallel processing
2. **Reliability**: Function warming + better error handling
3. **Testing**: Comprehensive E2E test suite
4. **Monitoring**: Add observability and metrics

### Short-term (1-2 months)
1. **Database**: PostgreSQL migration
2. **Tools**: Render scene and photo search integration
3. **UX**: Memory editing and search features
4. **Security**: Additional hardening and audit

### Long-term (3-6 months)
1. **Scale**: Multi-tenant architecture
2. **Healthcare**: HIPAA compliance and provider tools
3. **Mobile**: Native app development
4. **AI**: Advanced memory assessment capabilities

---

## 🔧 Environment & Deployment

### Required Environment Variables
```bash
# Core Configuration
NODE_ENV=production
PORT=3000
SESSION_SECRET=your_session_secret

# Firebase Configuration
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY=your_private_key

# AI Configuration
ANTHROPIC_API_KEY=your_anthropic_key

# Optional: CORS for multi-domain setup
CORS_ORIGIN=https://yourdomain.com
```

### Deployment
- **Platform**: Render (single web service)
- **Build**: `npm install && npm run build`
- **Start**: `npm start`
- **Health Check**: `/healthz`

---

## 🔒 Security & Privacy

### Current Measures
- ✅ Firebase authentication with token validation
- ✅ User data isolation (all data scoped to user ID)
- ✅ Hardened CSP with no unsafe-inline
- ✅ HTTPS-only in production
- ✅ Input validation and sanitization

## Security Audit

### Current Security Status
A comprehensive security audit has been conducted covering authentication, data protection, infrastructure, and AI integration. See [Security Audit Checklist](./security/audit-checklist.md) for full details.

### Critical Security Priorities
1. **Firebase Admin SDK Credentials** - Migrate from escaped JSON env var to Render Secret File or ADC
2. **Node.js Runtime Upgrade** - Update to Node 20.x LTS for security patches  
3. **Encryption Key Management** - Implement key rotation strategy and secure storage
4. **Data Retention Policy** - Define GDPR-compliant data handling procedures

### Security Strengths
- ✅ End-to-end user data isolation via Firebase Auth
- ✅ Database encryption at rest with AES-256-CBC
- ✅ Payload integrity checking with SHA-256 hashes
- ✅ CSP headers and CORS protection configured
- ✅ Rate limiting and request size controls
- ✅ SSE token-based authentication with reconnect logic

### Next Security Actions
- Address critical items before production deployment
- Implement security monitoring and alerting
- Schedule quarterly security reviews
- Consider third-party security audit for production

### Future Enhancements
- [ ] Rate limiting per user
- [ ] GDPR compliance tools
- [ ] HIPAA compliance (if healthcare features added)

---

## 🎯 Key Decisions & Trade-offs

### Architecture Decisions
- **Single Service**: Render hosts both frontend and API (simplicity over microservices)
- **Vanilla JS**: Keep current implementation (works well, elderly-friendly)
- **Firebase Auth**: Chosen for ease of use and security
- **Streaming**: SSE for real-time responses (better than polling)

### Performance Trade-offs
- **In-memory storage**: Fast but not persistent (will migrate to PostgreSQL)
- **Sequential processing**: Simple but slower (will parallelize)
- **Claude 4**: More capable but slower (will test Haiku)

---

## 📝 Documentation Status

### Current Documentation
- ✅ `PROJECT_ROADMAP.md` - This comprehensive roadmap
- ✅ `firebase-setup.md` - Authentication setup guide
- ✅ `api.md` - API documentation
- ✅ `agents.md` - Agent architecture
- ✅ `architecture/overview.md` - Technical overview

### Deprecated/Consolidated
- ❌ `project-plan.md` - Merged into this roadmap
- ❌ `prd.md` - Merged into this roadmap
- ❌ `react-frontend-plan.md` - Moved to Phase 4
- ❌ `tools-roadmap.md` - Merged into Phase 3
- ❌ `agent_story_prd.md` - Historical context, archived

---

## 🚀 Getting Started

### For Developers
1. Clone repository
2. Install dependencies: `npm install`
3. Set up Firebase project (see `firebase-setup.md`)
4. Configure environment variables
5. Start development: `npm run dev`

### For Deployment
1. Create Render account
2. Connect GitHub repository
3. Configure environment variables in Render dashboard
4. Deploy with `render.yaml` configuration

---

## 📞 Support & Contact

- **Repository**: GitHub Issues for bug reports
- **Documentation**: `/docs` directory
- **Architecture**: See `/docs/architecture/`
- **API Reference**: See `/docs/api.md`

---

*Last Updated: 2025-08-15*
*Status: Active Development*
