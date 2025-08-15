# React Frontend Project Plan
## Vite + React + TypeScript → Render Backend

### Overview
Migrate the current vanilla JS frontend to a modern React + TypeScript application that connects to the new Render backend via REST API and Server-Sent Events (SSE).

### Architecture
```
React Frontend (Vite)
├── REST API calls → Render Backend
├── SSE streams ← Render Backend  
└── Local state management (React Context)
```

### Project Structure
```
src/
├── components/
│   ├── Chat/
│   │   ├── ChatContainer.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageItem.tsx
│   │   ├── TypingIndicator.tsx
│   │   └── ChatInput.tsx
│   ├── Memory/
│   │   ├── MemoryPanel.tsx
│   │   ├── MemorySection.tsx
│   │   ├── MemoryItem.tsx
│   │   └── MemoryStatus.tsx
│   ├── Header/
│   │   ├── AppHeader.tsx
│   │   ├── ModelSelector.tsx
│   │   └── Controls.tsx
│   └── Layout/
│       ├── AppLayout.tsx
│       └── LoadingSpinner.tsx
├── hooks/
│   ├── useChat.ts          # Chat state & API calls
│   ├── useSSE.ts           # Server-Sent Events
│   ├── useMemory.ts        # Memory state management
│   └── useSession.ts       # Session persistence
├── services/
│   ├── api.ts              # Backend API client
│   ├── sse.ts              # SSE connection management
│   └── storage.ts          # Local storage utilities
├── types/
│   ├── chat.ts             # Chat message interfaces
│   ├── memory.ts           # Memory extraction types
│   ├── session.ts          # Session data types
│   └── api.ts              # API response types
├── context/
│   ├── ChatContext.tsx     # Global chat state
│   ├── MemoryContext.tsx   # Global memory state
│   └── AppContext.tsx      # App-wide state
├── utils/
│   ├── constants.ts        # App constants
│   └── helpers.ts          # Utility functions
└── styles/
    ├── globals.css         # Global styles
    └── components/         # Component-specific styles
```

### Key TypeScript Interfaces

#### Chat Types
```typescript
interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  agent?: 'collaborator' | 'memory-keeper';
  content: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}
```

#### Memory Types
```typescript
interface ExtractedMemories {
  people: Person[];
  dates: DateEvent[];
  places: Place[];
  relationships: Relationship[];
  events: Event[];
}

interface Person {
  name: string;
  relationship?: string;
  details?: string;
}

interface Place {
  location: string;
  significance?: string;
  type?: string;
  details?: string;
}
```

#### API Types
```typescript
interface ChatRequest {
  conversationId: string;
  messageId: string;
  text: string;
  model?: string;
}

interface SSEEvent {
  type: 'token' | 'done' | 'memory' | 'error';
  data: any;
}
```

### Backend Integration

#### REST API Endpoints
```typescript
// Chat endpoint - initiates SSE stream
POST /chat
Body: { conversationId, messageId, text, model }
Response: SSE stream with token events

// Memory events endpoint  
GET /events?conversationId=xyz
Response: SSE stream with memory extraction events

// Health check
GET /healthz
Response: { status: 'ok' }
```

#### SSE Event Handling
```typescript
// Token streaming from Collaborator
{ type: 'token', data: { token: 'Hello', partial: 'Hello there' } }

// Streaming completion
{ type: 'done', data: { messageId: '123', totalTokens: 45 } }

// Memory extraction results
{ type: 'memory', data: { memories: ExtractedMemories } }

// Error handling
{ type: 'error', data: { error: 'API timeout', code: 'TIMEOUT' } }
```

### Core Hooks

#### useChat Hook
```typescript
const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  
  const sendMessage = async (text: string) => {
    // POST to /chat, handle SSE response
  };
  
  return { messages, isTyping, sendMessage };
};
```

#### useSSE Hook
```typescript
const useSSE = (url: string) => {
  const [connectionState, setConnectionState] = useState<'connecting' | 'open' | 'closed'>('closed');
  
  const connect = () => {
    // EventSource connection with retry logic
  };
  
  return { connectionState, connect, disconnect };
};
```

### State Management Strategy

#### React Context for Global State
- **ChatContext**: Messages, typing state, session info
- **MemoryContext**: Extracted memories, processing status
- **AppContext**: Model selection, UI preferences

#### Local State for Components
- Form inputs (chat input, model selector)
- UI state (expanded panels, loading states)
- Component-specific data

### Performance Optimizations

#### React Optimizations
```typescript
// Memoize expensive operations
const processedMemories = useMemo(() => 
  organizeMemoriesByCategory(memories), [memories]
);

// Memoize components
const MessageItem = React.memo(({ message }: MessageProps) => {
  // Component logic
});

// Debounce auto-save
const debouncedSave = useCallback(
  debounce((session: ChatSession) => saveSession(session), 1000),
  []
);
```

#### Bundle Optimization
- Code splitting by route/feature
- Lazy loading for memory panel
- Tree shaking for unused utilities

### Error Handling

#### SSE Connection Issues
```typescript
const handleSSEError = (error: Event) => {
  console.error('SSE connection error:', error);
  // Exponential backoff retry
  setTimeout(() => reconnectSSE(), retryDelay);
};
```

#### API Error Boundaries
```typescript
const ChatErrorBoundary = ({ children }: { children: ReactNode }) => {
  // Catch and display user-friendly errors
  return <ErrorFallback />;
};
```

### Dependencies

#### Core Dependencies
```json
{
  "@types/react": "^18.2.0",
  "@types/react-dom": "^18.2.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "typescript": "^5.0.0",
  "vite": "^5.0.0"
}
```

#### Additional Libraries
```json
{
  "uuid": "^9.0.0",           // Message IDs
  "@types/uuid": "^9.0.0",
  "date-fns": "^2.30.0",      // Date formatting
  "clsx": "^2.0.0"            // Conditional CSS classes
}
```

### Development Phases

#### Phase 1: Project Setup (1-2 days)
- [x] Create Vite + React + TypeScript project
- [ ] Set up project structure
- [ ] Install dependencies
- [ ] Configure TypeScript interfaces

#### Phase 2: Core Components (2-3 days)
- [ ] Build ChatContainer and MessageList
- [ ] Create MemoryPanel components
- [ ] Implement basic layout and styling

#### Phase 3: Backend Integration (2-3 days)
- [ ] Implement REST API client
- [ ] Add SSE connection management
- [ ] Connect chat flow to backend

#### Phase 4: Advanced Features (2-3 days)
- [ ] Add session persistence
- [ ] Implement error boundaries
- [ ] Add loading states and optimizations

#### Phase 5: Polish & Testing (1-2 days)
- [ ] Performance optimization
- [ ] Cross-browser testing
- [ ] Documentation updates

### Success Criteria
- [ ] Real-time chat with streaming responses
- [ ] Live memory extraction display
- [ ] Smooth SSE connection handling
- [ ] Type-safe API integration
- [ ] Responsive, accessible UI
- [ ] Session persistence across refreshes
- [ ] Graceful error handling

### Migration Benefits
✅ **Type Safety**: Catch API integration errors at compile time  
✅ **Developer Experience**: Hot reload, intellisense, debugging tools  
✅ **Maintainability**: Component-based architecture, clear separation of concerns  
✅ **Performance**: Optimized bundle size, efficient re-renders  
✅ **Scalability**: Easy to add new features, agent types, or UI components  
✅ **Modern Tooling**: Vite's fast builds, React DevTools, TypeScript tooling  

### Notes
- Keep existing UX/UI design patterns for user familiarity
- Maintain elderly-friendly interface principles
- Preserve all current functionality while improving architecture
- Plan for future features (multiple conversation threads, export formats, etc.)