# Story Collection App – Technical Implementation Guide

Author: Junior Engineer
Last updated: 2025-08-15

---

## 1) High-level Architecture

- __Frontend__: Static HTML/CSS/Vanilla JS served by the same Express app.
- __Backend__: Node.js + Express server (`server.js`) with REST endpoints and SSE for streaming updates.
- __Authentication__: Firebase Auth in browser + Firebase Admin on server for token verification.
- __AI__: Anthropic SDK (Claude) for Collaborator and Memory Keeper agents.
- __State__: In-memory store for conversations/memories (temporary; roadmap includes PostgreSQL).
- __Hosting__: Single Render Web Service (serves static assets + API + SSE).

Diagram (conceptual):
Browser (Auth UI, Chat UI) ↔ Express (/api/*, /chat, /events) ↔ Anthropic API
                                  ↕
                             Firebase Admin (verifyIdToken)

---

## 2) Technologies & Libraries

- __Server__: Node.js (>=18; migrating to 20 LTS), Express, Helmet, CORS, express-rate-limit, EventEmitter.
- __Auth__: `firebase` (client in browser), `firebase-admin` (server), JWT ID tokens.
- __AI__: `@anthropic-ai/sdk` with streaming support.
- __Build/Deploy__: Render Web Service, `.nvmrc` for Node version; environment variables set in Render dashboard.
- __Frontend__: Vanilla JS modules, CSS; no framework by design (accessibility/maintainability).

Key files:
- `server.js`: app bootstrap, security middleware, endpoints, SSE, warming.
- `server/middleware/auth.js`: Firebase Admin init + `verifyFirebaseToken`, `optionalAuth`, `ensureUserScope`.
- `server/tools/*`: tool execution glue (`executeTool`).
- `server/storage/index.js`: in-memory store abstraction.
- `chat.html`, `index.html`: pages.
- `css/styles.css`, `css/auth.css`: UI.
- `js/app.js`, `js/auth-ui.js`, `js/firebase-config.js`, `js/config.js`.
- `docs/firebase-setup.md`, `docs/PROJECT_ROADMAP.md`.

---

## 3) Environment & Configuration

Environment variables (see `.env.example` and `/env.js` exposure on client):
- __Core__: `NODE_ENV`, `PORT`, `SESSION_SECRET`.
- __Firebase client (exposed to browser via `/env.js`)__:
  - `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`, `FIREBASE_MEASUREMENT_ID?`.
- __Firebase Admin (server)__:
  - Preferred: `FIREBASE_SERVICE_ACCOUNT_KEY_B64` (Base64-encoded JSON credentials)
  - Legacy: `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON string; fragile due to newlines)
  - Alternative: `GOOGLE_APPLICATION_CREDENTIALS` pointing to a Secret File (Render) for ADC.
- __Anthropic__: `ANTHROPIC_API_KEY`.
- __Security/ops__: `CORS_ORIGIN`, `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`, `LOG_LEVEL`.

Client config exposure: `server.js` serves `/env.js` which writes a sanitized `window.ENV` for Firebase initialization on the frontend.

---

## 4) Security Hardening

- __Helmet__: CSP and common security headers configured in `server.js`.
- __CORS__: Restricts origins via `CORS_ORIGIN` (comma-separated) with credentials disabled.
- __Auth__: All `/api/*`, `/chat`, and `/events` require a valid Firebase ID token (`verifyFirebaseToken`).
- __SSE__: Token checked per connection; rejected if missing/invalid.
- __Rate limiting__: `express-rate-limit` on API routes; `app.set('trust proxy', 1)` for Render so IPs are correct.
- __Secrets__: Admin key never sent to client; prefer Base64 env or Secret File. Do not commit service account JSON.

---

## 5) Backend Implementation Details

### 5.1 Express initialization (`server.js`)
- Loads env (`dotenv`), configures `helmet`, `cors`, JSON/urlencoded parsers.
- `app.set('trust proxy', 1)` to play nice behind Render’s proxy.
- Initializes Anthropic SDK with `ANTHROPIC_API_KEY`.
- Warming: simple interval pings in production to mitigate cold starts.

### 5.2 Firebase Admin init (`server/middleware/auth.js`)
- Tries `FIREBASE_SERVICE_ACCOUNT_KEY_B64` first (Base64 → JSON → `admin.credential.cert`).
- Fallback to `FIREBASE_SERVICE_ACCOUNT_KEY` (JSON parse) if set.
- Else attempts ADC (`GOOGLE_APPLICATION_CREDENTIALS`) or projectId-only mode in dev.
- Exports:
  - `verifyFirebaseToken(req,res,next)`: rejects 401 if missing/invalid token.
  - `optionalAuth`: continues without user if no token.
  - `ensureUserScope`: prefixes conversation/memory IDs with `req.userId`.

### 5.3 Endpoints (selected)
- `GET /healthz`: health probe.
- `GET /env.js`: sends safe Firebase client config to browser.
- `GET /events`: Server-Sent Events; requires valid token; streams updates.
- `POST /chat`: main chat endpoint, triggers Collaborator and Memory Keeper flows; returns/streams messages.
- `GET /api/memories`: list user-scoped memories for a conversation.
- `POST /api/memory-keeper`: memory extraction agent.
- `POST /api/collaborator`: collaborator agent.

### 5.4 Storage
- `server/storage/index.js`: in-memory store keyed by `userId_conversationId`. Roadmap to move to PostgreSQL.

---

## 6) Frontend Implementation Details

### 6.1 Pages
- `index.html` (landing & auth) and `chat.html` (authenticated chat).
- `app-header` with controls (reset, export, model selection).

### 6.2 Authentication
- `js/auth-ui.js`: sign-in/sign-up flows, token handling, logout, UI gating.
- `js/firebase-config.js`: initializes Firebase using `window.ENV`.
- Tokens are retrieved by Firebase client and sent as `Authorization: Bearer <idToken>` to server.

### 6.3 Chat & Memory UI
- `js/app.js`: manages chat submit, streaming updates, and memory updates via SSE.
- Layout: `.main-content` contains `.chat-section` and `.memory-panel` side-by-side (desktop) or stacked (mobile).
- Scrolling: independent scrolls inside `div.chat-messages` and `div.memory-content`; page scrolls as needed (`css/styles.css`).

### 6.4 Styling
- `css/styles.css`: componentized rules for header, chat bubbles, memory sections, responsive behavior, and accessibility.
- `css/auth.css`: authentication components.

---

## 7) AI Agent Flows

- __Collaborator__: Warmer, empathetic conversation; can be tuned via model select (Sonnet/Haiku).
- __Memory Keeper__: Extracts structured data (people, places, dates, relationships, events).
- The app can run calls in parallel and/or stream results; token limits tuned for latency.

---

## 8) Deployment (Render)

- Single Web Service; build: `npm install` (no separate build step); start: `npm start`.
- Health check: `/healthz`.
- Env vars in Render dashboard (see Section 3).
- Node version: using `.nvmrc`; roadmap to ensure 20 LTS.
- Proxy considerations: `app.set('trust proxy', 1)` required for rate limiting.
- Recommended secret handling:
  - Prefer Secret File + `GOOGLE_APPLICATION_CREDENTIALS` (ADC), or
  - Use `FIREBASE_SERVICE_ACCOUNT_KEY_B64` to avoid newline escaping issues.

---

## 9) Local Development

```
# 1) Setup
cp .env.example .env
# Fill env values (Anthropic key, Firebase client config, and Admin key via B64 or JSON for dev)

# 2) Install & run
npm install
npm run dev   # or: npm start

# 3) Visit
http://localhost:3000/index.html → login
http://localhost:3000/chat.html   → chat UI (requires auth)
```

---

## 10) Troubleshooting Notes

- __Firebase Admin init failed: Unexpected end of JSON input__
  - Usually malformed `FIREBASE_SERVICE_ACCOUNT_KEY`. Prefer `FIREBASE_SERVICE_ACCOUNT_KEY_B64`.
- __express-rate-limit X-Forwarded-For warning__
  - Ensure `app.set('trust proxy', 1)` is set (behind Render proxy).
- __SSE not connecting__
  - Confirm token is sent; watch logs for `Firebase Admin not initialized`.
- __Slow responses__
  - Consider Haiku model, parallelization, smaller token limits, and function warming.

---

## 11) Roadmap Pointers

- Switch Node to active LTS (20.x) across local and Render.
- Replace newline-escaped Admin JSON with Base64 or Secret File ADC.
- Migrate storage to PostgreSQL and add persistence.
- Expand test coverage (unit/integration/E2E) and observability.

---

## 12) How to Take Over

- Review `server.js` and `server/middleware/auth.js` first; they define most server behavior and auth.
- Check `js/app.js` for the chat loop and SSE handling.
- Validate env setup via `/env.js` and Render dashboard.
- Start with small changes (e.g., copy updates to memory rendering), then move to persistence & tests.

If anything here isn’t clear, I’m happy to walk through the code paths live; I tried to capture all the key decisions and trade-offs without over-claiming.
