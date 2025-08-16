# Security Audit: Story Collection App

**Stack:** Vanilla JS + Express/Node + Firebase Auth + Anthropic Claude + Render  
**Application Type:** AI-powered conversational story collection for elderly users  
**Data Sensitivity:** High (personal stories, family histories, health information)  
**Compliance:** GDPR, CCPA considerations for personal data

## Phase 1: Threat Modeling & Architecture Review

### Project Context Analysis
- **Application Type:** Web application with real-time SSE streaming
- **Data Handled:** Personal life stories, family relationships, health information, dates/places
- **Users:** Elderly individuals sharing sensitive personal histories
- **Scale:** Small to medium scale, high availability for user trust
- **Regulatory:** GDPR/CCPA compliance for personal data, potential HIPAA considerations for health info

### Threat Model Assessment
- **Attack Surface:** 
  - `/api/*` endpoints (memory-keeper, collaborator, logout, health)
  - `/chat` SSE streaming endpoint
  - `/events` SSE subscription endpoint
  - Firebase Auth integration
  - Anthropic API integration
- **Threat Actors:** Script kiddies, data harvesters, competitors
- **High-Value Targets:** `encrypted_memories` database, Firebase tokens, Anthropic API keys
- **Trust Boundaries:** Client ↔ Express ↔ Firebase Admin ↔ Database, Express ↔ Anthropic

### Architecture Security Review
- **Network:** HTTPS-only, Render hosting, Firebase Auth cloud
- **Trust Boundaries:** Firebase token validation at Express middleware layer
- **Single Points of Failure:** Anthropic API, Firebase Auth service
- **Third-Party Risks:** Firebase Admin SDK, Anthropic SDK, PostgreSQL driver

## Phase 2: Implementation Security Review

### 🔐 Authentication & Authorization (Firebase)

**Firebase Configuration:**
- [x] Firebase Admin SDK properly initialized with service account
- [x] JWT verification on all protected endpoints (`verifyFirebaseToken` middleware)
- [x] Token validation includes signature, issuer, audience, expiry
- [ ] **CRITICAL:** Firebase Admin SDK uses escaped JSON env var (fragile) - migrate to ADC/Secret File
- [x] User data isolation via `req.userId` scoping
- [x] SSE authentication via token-in-query parameter

**Token Security:**
- [x] Firebase handles token storage and rotation automatically
- [x] Backend validates tokens on every request
- [x] SSE reconnects on token changes (prevents stale tokens)
- [x] Logout endpoint for server-side cleanup notification
- [ ] **MEDIUM:** Consider token blacklisting for immediate revocation

### 🖥️ Frontend Security (Vanilla JS)

**Environment & Build Security:**
- [x] No secrets in client-side environment variables
- [x] Firebase client config properly exposed via `/env.js`
- [x] No sensitive data in client-side JavaScript
- [x] HTTPS enforcement via Render platform

**Application Security:**
- [x] Input sanitization via `sanitizeErrorForUser()` function
- [x] No use of `innerHTML` or `eval()`
- [x] CSP headers configured in Helmet
- [ ] **MEDIUM:** Review CSP directives for tightening (currently allows 'unsafe-hashes')
- [x] Secure session storage with encryption (`CryptoJS.AES`)
- [x] No sensitive data in localStorage

### 🔧 Backend Security (Express/Node)

**Server Configuration:**
- [x] Helmet CSP configured with specific directives
- [x] CORS properly configured with origin restrictions
- [x] Rate limiting implemented (`express-rate-limit`)
- [x] Request size limits (`10mb` JSON limit)
- [x] Trust proxy settings for Render deployment
- [ ] **HIGH:** Upgrade to Node.js 20.x LTS (currently unspecified)

**Input Validation & Sanitization:**
- [x] Message length limits (`MAX_MESSAGE_LENGTH` = 5000 chars)
- [x] Model whitelist validation (`ALLOWED_MODELS`)
- [x] Timeout protection on Anthropic API calls (20s)
- [ ] **MEDIUM:** Add input validation schemas (Joi/Zod)
- [ ] **LOW:** Sanitize user input before Anthropic API calls

**Error Handling:**
- [x] Error details hidden in production (`NODE_ENV` check)
- [x] Structured error logging
- [ ] **MEDIUM:** Ensure no PII in error logs
- [ ] **LOW:** Implement error monitoring (Sentry)

### 🗄️ Data Protection

**Encryption:**
- [x] Database encryption at rest via `encrypted_memories` table
- [x] AES-256-CBC encryption for memory payloads
- [x] Payload integrity checking via SHA-256 hashes
- [x] Encryption key validation (64-char hex requirement)
- [ ] **HIGH:** Implement encryption key rotation strategy
- [ ] **MEDIUM:** Consider envelope encryption for additional security

**Database Security:**
- [x] User data isolation via user_id scoping
- [x] Parameterized queries (no SQL injection)
- [x] Unique constraints for deduplication
- [x] Audit logging for all database operations
- [ ] **MEDIUM:** Database connection encryption (verify SSL settings)
- [ ] **LOW:** Consider database-level encryption (PostgreSQL TDE)

**Data Retention:**
- [ ] **HIGH:** Define data retention policy for personal stories
- [ ] **MEDIUM:** Implement data deletion endpoints (GDPR compliance)
- [ ] **LOW:** Automated data archival for old conversations

### 🤖 AI Integration Security (Anthropic)

**API Security:**
- [x] API key stored in environment variables
- [x] Model whitelist prevents unauthorized model usage
- [x] Token limits enforced (300 tokens max)
- [x] Timeout protection (20s)
- [ ] **HIGH:** Rotate Anthropic API keys regularly
- [ ] **MEDIUM:** Monitor API usage for anomalies
- [ ] **LOW:** Implement request/response logging (sanitized)

**Prompt Security:**
- [x] System prompts are hardcoded (no injection)
- [x] User input is JSON-escaped before API calls
- [ ] **MEDIUM:** Review system prompts for information leakage
- [ ] **LOW:** Implement prompt injection detection

### 🌐 Infrastructure Security (Render)

**Deployment Security:**
- [x] HTTPS enforced by platform
- [x] Environment variables for secrets
- [ ] **HIGH:** Use Render Secret Files instead of env vars for Firebase keys
- [ ] **MEDIUM:** Enable Render's DDoS protection
- [ ] **LOW:** Configure custom domain with HSTS

**Monitoring & Logging:**
- [x] Basic health check endpoint (`/healthz`)
- [x] Function warming to prevent cold starts
- [ ] **HIGH:** Implement security monitoring and alerting
- [ ] **MEDIUM:** Log aggregation and analysis
- [ ] **LOW:** Performance monitoring (APM)

### 🔄 SSE Security

**Connection Security:**
- [x] Token-based authentication for SSE connections
- [x] User-scoped conversation channels
- [x] Heartbeat to maintain connections
- [x] Proper connection cleanup on client disconnect
- [ ] **MEDIUM:** Rate limiting for SSE connections
- [ ] **LOW:** Connection monitoring and abuse detection

**Data Leakage Prevention:**
- [x] Memory updates scoped to authenticated user
- [x] No sensitive data in SSE heartbeat messages
- [ ] **MEDIUM:** Audit SSE event data for PII leakage

## Phase 3: Priority Security Fixes

### 🚨 Critical (Fix Immediately)
1. **Firebase Admin SDK Credentials:** Migrate from escaped JSON env var to Render Secret File or ADC
2. **Node.js Runtime:** Upgrade to Node 20.x LTS for security patches
3. **Encryption Key Management:** Implement key rotation strategy and secure storage

### ⚠️ High Priority (Fix This Sprint)
1. **Data Retention Policy:** Define and implement GDPR-compliant data handling
2. **API Key Rotation:** Establish regular Anthropic API key rotation
3. **Security Monitoring:** Implement basic security alerting and log analysis

### 📋 Medium Priority (Next Sprint)
1. **CSP Tightening:** Review and restrict Content Security Policy directives
2. **Input Validation:** Add comprehensive schema validation for all endpoints
3. **Database Security:** Verify and enforce SSL connections to PostgreSQL
4. **Token Blacklisting:** Consider implementing immediate token revocation

### 📝 Low Priority (Backlog)
1. **Error Monitoring:** Integrate Sentry or similar for error tracking
2. **Performance Monitoring:** Add APM for security and performance insights
3. **Prompt Security:** Review AI prompts for potential information leakage
4. **Connection Monitoring:** Add SSE connection abuse detection

## Compliance Checklist

### GDPR Compliance
- [ ] Data processing lawful basis documented
- [ ] Privacy policy covers AI processing of personal stories
- [ ] Data subject rights implemented (access, rectification, erasure)
- [ ] Data retention periods defined and enforced
- [ ] Data breach notification procedures established

### Security Best Practices
- [x] Principle of least privilege (user data isolation)
- [x] Defense in depth (multiple security layers)
- [x] Secure by default (authentication required)
- [ ] Regular security updates and patches
- [ ] Incident response plan documented

## Next Steps
1. Address critical security fixes immediately
2. Implement high-priority items in current development cycle
3. Schedule regular security reviews (quarterly)
4. Consider third-party security audit for production deployment
5. Establish security monitoring and incident response procedures
