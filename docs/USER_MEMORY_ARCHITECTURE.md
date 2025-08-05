# User Memory & Database Architecture Plan
## Vibe-Agents: Persistent User Stories & Conversations

### 🎯 **OVERVIEW**
Transform Vibe-Agents from a session-based prototype to a persistent, user-centric platform where seniors can build and maintain their life story collections over time through multiple conversations.

---

## 🏗️ **DATABASE SCHEMA DESIGN**

### **Core Tables**

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    preferences JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true
);

-- Conversations table
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL, -- Auto-generated from first message
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_archived BOOLEAN DEFAULT false,
    message_count INTEGER DEFAULT 0,
    memory_count INTEGER DEFAULT 0
);

-- Messages table
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- 'user', 'collaborator', 'system'
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message_type VARCHAR(50) DEFAULT 'chat', -- 'chat', 'memory_extraction'
    metadata JSONB DEFAULT '{}'
);

-- Memories table
CREATE TABLE memories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- 'people', 'places', 'dates', 'relationships', 'events'
    content JSONB NOT NULL, -- Structured memory data
    extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT false, -- User can verify/edit memories
    confidence_score DECIMAL(3,2), -- AI confidence in extraction
    source_message_id INTEGER REFERENCES messages(id)
);

-- Memory connections (for relationship mapping)
CREATE TABLE memory_connections (
    id SERIAL PRIMARY KEY,
    memory_id_1 INTEGER REFERENCES memories(id) ON DELETE CASCADE,
    memory_id_2 INTEGER REFERENCES memories(id) ON DELETE CASCADE,
    connection_type VARCHAR(100), -- 'family_relation', 'location_event', etc.
    strength DECIMAL(3,2) DEFAULT 0.5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Indexes for Performance**
```sql
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_category ON memories(category);
CREATE INDEX idx_memories_conversation_id ON memories(conversation_id);
```

---

## 🔐 **AUTHENTICATION STRATEGY**

### **Recommended: Magic Link Authentication**
**Why Magic Links for Seniors:**
- ✅ No passwords to remember or forget
- ✅ Familiar email-based flow
- ✅ Secure by default
- ✅ Reduces support burden
- ✅ Works on all devices

### **Authentication Flow:**
1. User enters email address
2. System sends magic link to email
3. User clicks link → automatically logged in
4. Session stored with JWT token
5. Auto-logout after 30 days of inactivity

### **Fallback Options:**
- Simple email/password for users who prefer it
- OAuth (Google) for tech-savvy users
- Family member account management

---

## 🏛️ **SERVER-CENTRIC ARCHITECTURE**

### **Current vs New Architecture:**

**Current (Client-Heavy):**
```
Browser → Netlify Functions → Claude API
   ↓
sessionStorage (temporary)
```

**New (Server-Centric):**
```
Browser (Thin Client) → Express Server → Claude API
                            ↓
                       PostgreSQL Database
```

### **API Endpoints Design:**

```javascript
// Authentication
POST /api/auth/request-magic-link
POST /api/auth/verify-magic-link
POST /api/auth/logout
GET  /api/auth/me

// Conversations
GET    /api/conversations              // List user's conversations
POST   /api/conversations              // Create new conversation
GET    /api/conversations/:id          // Get conversation with messages
PUT    /api/conversations/:id          // Update conversation (title, archive)
DELETE /api/conversations/:id          // Delete conversation

// Messages
POST   /api/conversations/:id/messages // Send message (triggers AI response)
GET    /api/conversations/:id/messages // Get conversation messages

// Memories
GET    /api/memories                   // Get all user memories (with filters)
GET    /api/conversations/:id/memories // Get memories from specific conversation
PUT    /api/memories/:id               // Update/verify memory
DELETE /api/memories/:id               // Delete memory

// Search
GET    /api/search/conversations       // Search conversations
GET    /api/search/memories           // Search memories
GET    /api/search/global             // Search everything

// Export
GET    /api/export/conversation/:id   // Export conversation (PDF/text)
GET    /api/export/memories           // Export all memories
```

---

## 👥 **USER EXPERIENCE DESIGN**

### **Main Navigation:**
```
┌─────────────────────────────────────┐
│ 🏠 Vibe-Agents                     │
│                                     │
│ 📝 New Conversation                 │
│ 📚 My Stories (Conversations)       │
│ 🧠 My Memories                      │
│ 👤 Profile & Settings               │
│ 📤 Export & Share                   │
└─────────────────────────────────────┘
```

### **Conversation List View:**
```
My Stories
┌─────────────────────────────────────┐
│ 📖 Childhood in Albany              │
│     Last updated: 2 days ago        │
│     15 messages, 8 memories         │
├─────────────────────────────────────┤
│ 🏫 School Days at PS 16             │
│     Last updated: 1 week ago        │
│     23 messages, 12 memories        │
├─────────────────────────────────────┤
│ 💒 Wedding Day Memories             │
│     Last updated: 2 weeks ago       │
│     31 messages, 18 memories        │
└─────────────────────────────────────┘
```

### **Memory Dashboard:**
```
My Memories
┌─────────────────────────────────────┐
│ 👥 People (24)    📍 Places (18)    │
│ 📅 Dates (15)     💕 Relationships  │
│ 🎉 Events (22)    🔍 Search All     │
└─────────────────────────────────────┘

Recent Memories:
┌─────────────────────────────────────┐
│ 👤 Henry Robinson                   │
│     From: Childhood in Albany       │
│     Added: 2 days ago               │
│     ✅ Verified                     │
└─────────────────────────────────────┘
```

---

## 🔒 **PRIVACY & SECURITY CONSIDERATIONS**

### **Data Protection:**
- **Encryption at Rest**: All conversation content and memories encrypted
- **GDPR Compliance**: Right to deletion, data portability
- **Data Retention**: User-controlled retention policies
- **Audit Logging**: Track all data access and modifications

### **Access Control:**
- **User Isolation**: Strict user data separation
- **Session Security**: Secure JWT tokens, auto-expiry
- **API Rate Limiting**: Prevent abuse and DoS
- **Input Sanitization**: Prevent injection attacks

### **Family Sharing (Optional):**
- **Controlled Sharing**: Users can share specific conversations
- **Permission Levels**: View-only vs edit access
- **Family Accounts**: Link family member accounts
- **Privacy Controls**: Granular sharing settings

---

## 📱 **TECHNOLOGY STACK RECOMMENDATIONS**

### **Backend:**
- **Framework**: Express.js (Node.js) - familiar, mature
- **Database**: PostgreSQL - robust, excellent JSON support
- **Authentication**: Passport.js + custom magic link strategy
- **Email**: SendGrid or AWS SES for magic links
- **File Storage**: AWS S3 for exports and attachments

### **Frontend:**
- **Keep Current**: Vanilla JS, HTML, CSS (senior-friendly)
- **Enhance**: Progressive Web App (PWA) capabilities
- **Mobile**: Responsive design, touch-friendly

### **Deployment:**
- **Server**: Railway, Render, or AWS ECS
- **Database**: Managed PostgreSQL (AWS RDS, Railway)
- **CDN**: CloudFlare for static assets
- **Monitoring**: DataDog or New Relic

---

## 🚀 **PHASED IMPLEMENTATION PLAN**

### **Phase 1: Foundation (2-3 weeks)**
- [ ] Set up PostgreSQL database with schema
- [ ] Create Express.js server with basic routing
- [ ] Implement magic link authentication
- [ ] Build user registration/login flow
- [ ] Create basic conversation CRUD operations
- [ ] Migrate current prototype to use database

### **Phase 2: Core Features (2-3 weeks)**
- [ ] Implement message persistence and retrieval
- [ ] Integrate Memory Keeper with database storage
- [ ] Build conversation list/history UI
- [ ] Add conversation search functionality
- [ ] Create memory viewing interface
- [ ] Implement memory verification/editing

### **Phase 3: Enhanced UX (2-3 weeks)**
- [ ] Build comprehensive memory dashboard
- [ ] Add memory search across conversations
- [ ] Create conversation and memory export (PDF/text)
- [ ] Implement conversation archiving/organization
- [ ] Add user preferences and settings
- [ ] Mobile-responsive design improvements

### **Phase 4: Advanced Features (3-4 weeks)**
- [ ] Memory relationship mapping and visualization
- [ ] Family sharing capabilities
- [ ] Advanced search with filters
- [ ] Memory timeline visualization
- [ ] Voice-to-text integration
- [ ] Progressive Web App (PWA) features

### **Phase 5: Production Ready (1-2 weeks)**
- [ ] Performance optimization and caching
- [ ] Comprehensive security audit
- [ ] Load testing and scaling
- [ ] Backup and disaster recovery
- [ ] Documentation and user guides
- [ ] Production deployment

---

## 📊 **SUCCESS METRICS**

### **User Engagement:**
- Daily/weekly active users
- Conversations per user
- Messages per conversation
- Memory verification rate
- Session duration

### **Technical Performance:**
- API response times
- Database query performance
- Memory extraction accuracy
- System uptime
- Error rates

### **User Satisfaction:**
- User retention rate
- Feature usage analytics
- Support ticket volume
- User feedback scores
- Family sharing adoption

---

## 🎯 **NEXT STEPS**

1. **Review & Approve Architecture**: Get stakeholder sign-off on this plan
2. **Set Up Development Environment**: Database, server, deployment pipeline
3. **Begin Phase 1 Implementation**: Start with authentication and basic persistence
4. **Iterative Development**: Build, test, and refine each phase
5. **User Testing**: Involve seniors throughout development process

---

*This architecture transforms Vibe-Agents from a prototype into a production-ready platform for preserving and sharing life stories, designed specifically for senior users with their unique needs and preferences in mind.*
