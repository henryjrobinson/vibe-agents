-- Complete Database Schema for Vibe Agents
-- Includes Phase 1 (Authentication) and Phase 2 (Conversations & Memories)

-- Phase 1: Authentication Tables

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP
);

-- User sessions table
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Phase 2: Conversation and Memory Tables

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

-- Indexes for Performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_category ON memories(category);
CREATE INDEX idx_memories_conversation_id ON memories(conversation_id);
CREATE INDEX idx_memory_connections_memory1 ON memory_connections(memory_id_1);
CREATE INDEX idx_memory_connections_memory2 ON memory_connections(memory_id_2);

-- Update triggers for conversation updated_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET updated_at = CURRENT_TIMESTAMP,
        message_count = (SELECT COUNT(*) FROM messages WHERE conversation_id = NEW.conversation_id)
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Update trigger for memory count
CREATE OR REPLACE FUNCTION update_memory_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations 
    SET memory_count = (SELECT COUNT(*) FROM memories WHERE conversation_id = NEW.conversation_id)
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_memory_count
    AFTER INSERT OR DELETE ON memories
    FOR EACH ROW
    EXECUTE FUNCTION update_memory_count();

-- Constraints to prevent duplicate memory connections
ALTER TABLE memory_connections 
ADD CONSTRAINT unique_memory_connection 
UNIQUE (memory_id_1, memory_id_2, connection_type);

-- Ensure memory connections don't reference the same memory twice
ALTER TABLE memory_connections 
ADD CONSTRAINT check_different_memories 
CHECK (memory_id_1 != memory_id_2);
