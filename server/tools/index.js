// Tools registry and executor
// Each tool module should export: { name, description, inputSchema, run }

const memoryExtractor = require('./memoryExtractor');

// Placeholder stubs for future tools
const renderScene = {
  name: 'render_scene',
  description: 'Render a visual scene matching the described memory (e.g., snowball fight in the 1950s)',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string' },
      style: { type: 'string', enum: ['photorealistic', 'illustration', 'vintage', 'film'] },
      aspectRatio: { type: 'string' }
    },
    required: ['prompt']
  },
  // Not implemented yet; placeholder
  run: async () => {
    throw new Error('render_scene tool not implemented');
  }
};

const searchPhotos = {
  name: 'search_photos',
  description: 'Search Google Photos for people/places mentioned in the conversation',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      people: { type: 'array', items: { type: 'string' } },
      places: { type: 'array', items: { type: 'string' } },
      timeRange: { type: 'string' }
    }
  },
  run: async () => {
    throw new Error('search_photos tool not implemented');
  }
};

const tools = [memoryExtractor, renderScene, searchPhotos];

function getTool(name) {
  return tools.find(t => t.name === name);
}

async function executeTool(name, input, context = {}) {
  const tool = getTool(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  // Simple input validation (schema-only, non-strict)
  if (tool.inputSchema && typeof input !== 'object') {
    throw new Error('Tool input must be an object');
  }
  return tool.run(input, context);
}

module.exports = {
  tools,
  getTool,
  executeTool
};
