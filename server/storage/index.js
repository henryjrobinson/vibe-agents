// Simple in-memory memory store (pluggable for DB later)
// NOTE: Render's filesystem is ephemeral; do not rely on file writes. This store resets on restart.

const { randomUUID } = require('crypto');

class MemoryStore {
  constructor() {
    // Map<conversationId, Array<MemoryRecord>>
    this.byConversation = new Map();
  }

  // memory: { id, conversationId, messageId, payload, createdAt }
  saveMemory({ conversationId = 'default', messageId, payload, createdAt = new Date().toISOString() }) {
    if (!payload || typeof payload !== 'object') return null;
    const nonEmpty = ['people', 'dates', 'places', 'relationships', 'events']
      .some(k => Array.isArray(payload[k]) && payload[k].length > 0) ||
      (payload.narrator && typeof payload.narrator === 'string' && payload.narrator.trim());
    if (!nonEmpty) return null; // store only meaningful extractions

    const mem = {
      id: randomUUID(),
      conversationId,
      messageId,
      payload,
      createdAt
    };
    if (!this.byConversation.has(conversationId)) this.byConversation.set(conversationId, []);
    this.byConversation.get(conversationId).push(mem);
    return mem;
  }

  listMemories(conversationId = 'default') {
    return this.byConversation.get(conversationId) || [];
  }

  getMemory(conversationId, id) {
    const list = this.byConversation.get(conversationId) || [];
    return list.find(m => m.id === id) || null;
  }

  clearConversation(conversationId = 'default') {
    this.byConversation.delete(conversationId);
  }
}

module.exports = new MemoryStore();
