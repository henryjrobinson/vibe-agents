-- Vibe-Agents Database Schema
-- PostgreSQL 15+ compatible

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
    title VARCHAR(500) NOT NULL,
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

-- Magic link tokens for authentication
CREATE TABLE magic_link_tokens (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_agent TEXT,
    ip_address INET
);

-- Performance indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_category ON memories(category);
CREATE INDEX idx_memories_conversation_id ON memories(conversation_id);
CREATE INDEX idx_memories_extracted_at ON memories(extracted_at DESC);
CREATE INDEX idx_magic_link_tokens_token ON magic_link_tokens(token);
CREATE INDEX idx_magic_link_tokens_email ON magic_link_tokens(email);
CREATE INDEX idx_magic_link_tokens_expires_at ON magic_link_tokens(expires_at);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update message_count on conversations
CREATE OR REPLACE FUNCTION update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE conversations 
        SET message_count = message_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.conversation_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE conversations 
        SET message_count = message_count - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.conversation_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_message_count_on_insert AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_message_count();

CREATE TRIGGER update_message_count_on_delete AFTER DELETE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_message_count();

-- Trigger to update memory_count on conversations
CREATE OR REPLACE FUNCTION update_conversation_memory_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE conversations 
        SET memory_count = memory_count + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.conversation_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE conversations 
        SET memory_count = memory_count - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.conversation_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_memory_count_on_insert AFTER INSERT ON memories
    FOR EACH ROW EXECUTE FUNCTION update_conversation_memory_count();

CREATE TRIGGER update_memory_count_on_delete AFTER DELETE ON memories
    FOR EACH ROW EXECUTE FUNCTION update_conversation_memory_count();

-- Cleanup function for expired tokens and sessions
CREATE OR REPLACE FUNCTION cleanup_expired_tokens_and_sessions()
RETURNS void AS $$
BEGIN
    -- Delete expired magic link tokens
    DELETE FROM magic_link_tokens WHERE expires_at < CURRENT_TIMESTAMP;
    
    -- Delete expired user sessions
    DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ language 'plpgsql';

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts with authentication and preferences';
COMMENT ON TABLE conversations IS 'User conversation sessions with metadata';
COMMENT ON TABLE messages IS 'Individual messages within conversations';
COMMENT ON TABLE memories IS 'Extracted and structured memories from conversations';
COMMENT ON TABLE memory_connections IS 'Relationships and connections between memories';
COMMENT ON TABLE magic_link_tokens IS 'Temporary tokens for magic link authentication';
COMMENT ON TABLE user_sessions IS 'Active user sessions with JWT tokens';

COMMENT ON COLUMN memories.content IS 'JSONB structure varies by category: people, places, dates, relationships, events';
COMMENT ON COLUMN memories.confidence_score IS 'AI confidence score from 0.00 to 1.00';
COMMENT ON COLUMN magic_link_tokens.token IS 'Cryptographically secure random token';
COMMENT ON COLUMN user_sessions.session_token IS 'JWT token for session authentication';
