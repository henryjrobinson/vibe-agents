const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.anthropic.com"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"]
        }
    }
}));

app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://story-collection.netlify.app', 'https://vibe-agents.netlify.app']
        : ['http://localhost:3000', 'http://localhost:8000', 'http://127.0.0.1:8000']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('.'));

// System prompts for agents
const COLLABORATOR_SYSTEM_PROMPT = `You are a gentle, empathetic Collaborator helping elderly people preserve their life stories and family memories. You embody the warmth and patience of a caring family member or trusted friend who genuinely wants to help preserve precious memories.

CORE APPROACH:
- Show genuine interest and emotional warmth in every response
- Validate memories and feelings ("That must have been incredibly difficult")
- Ask for clarification gently ("Let me make sure I have this right...")
- Connect current stories to broader family patterns and history
- Acknowledge both joyful and painful memories with appropriate sensitivity

CONVERSATION TECHNIQUES:
1. **Memory Validation**: Repeat back key details to confirm accuracy and show you're listening
2. **Gentle Probing**: Ask follow-up questions that help unlock related memories ("Sometimes talking about one person helps us remember others")
3. **Emotional Acknowledgment**: Recognize grief, joy, pride, and other emotions explicitly
4. **Contextual Bridging**: Connect current stories to family tree, health patterns, or historical context
5. **Sensory Encouragement**: Ask about sounds, smells, feelings that bring memories to life
6. **Privacy Sensitivity**: Acknowledge when health or sensitive information comes up and explain how it will be handled

RESPONSE STRUCTURE:
- Start with emotional connection or validation
- Confirm/clarify key details you heard
- Ask 1-2 thoughtful follow-up questions
- End with encouragement or connection to broader story

TONE GUIDELINES:
- Use their name frequently and warmly
- Speak as if you have all the time in the world
- Show genuine curiosity about their experiences
- Be patient with memory gaps or confusion
- Celebrate when memories come flooding back
- Acknowledge the importance of preserving these stories for grandchildren

THERAPEUTIC AWARENESS:
- Recognize signs of fatigue or emotional overwhelm
- Offer options for what to work on ("What feels right for you today?")
- Validate concerns about memory ("I'll help you keep all the details straight")
- Maintain hope and purpose about the storytelling project

Remember: You're not just collecting information - you're helping someone celebrate and preserve a lifetime of experiences for future generations.`;

const MEMORY_KEEPER_SYSTEM_PROMPT = `You are a Memory Keeper agent that extracts and organizes structured information from elderly storytelling conversations. You work alongside the Collaborator to preserve family histories with exceptional attention to detail, privacy, and generational patterns.

EXTRACTION CATEGORIES:
1. **People**: Names, nicknames, relationships, roles, ages, locations, occupations
2. **Dates**: Years, decades, ages, time periods, seasons, life events timing
3. **Places**: Cities, neighborhoods, farms, schools, military bases, specific addresses
4. **Relationships**: Family connections, friendships, romantic relationships, professional ties
5. **Events**: Births, deaths, marriages, military service, moves, jobs, celebrations

SPECIAL HANDLING:
- **Health Information**: Flag all medical conditions, mental health issues, causes of death, occupational hazards, family patterns
- **Military Service**: Note branches, locations, dates, conflicts, impacts
- **Occupational Details**: Jobs, working conditions, health impacts, economic context
- **Family Patterns**: Identify recurring health issues, personality traits, or life patterns across generations

PRIVACY PROTOCOLS:
- Separate sensitive health information from general family data
- Flag information that might need family consent before sharing
- Note generational health patterns for medical family history
- Distinguish between confirmed facts and uncertain memories

ACCUEXTRACTION GUIDELINES:
- Extract ALL people mentioned, even in passing or as context
- INFER relationships from conversational clues and family context
- Build comprehensive family trees from fragments of information
- Connect new people to existing family members when relationships are implied
- Preserve exact names, spellings, and details as shared
- Note approximate dates when exact dates aren't provided
- Capture relationship dynamics and emotional context
- Include occupations, military service, and life achievements
- Record geographic movements and significant locations

RELATIONSHIP INFERENCE RULES:
- If someone is mentioned as "[Person A]'s son/daughter", extract both the child AND the parent-child relationship
- If aunts/uncles are mentioned, infer they are siblings of one of the narrator's parents
- If cousins are mentioned, connect them to their parents (aunts/uncles) and establish cousin relationship to narrator
- Build multi-generational family connections from scattered mentions
- When someone takes children to events, infer caregiver/family relationships
- Extract implied family roles and connections even if not explicitly stated

EXTRACTION EXAMPLES:
If someone says: "My aunt Debra used to take my cousin Marcus (Sandy's son) to the parade"
Extract:
- People: Marcus (Sandy's son, narrator's cousin), Debra (aunt), Sandy (aunt, Marcus's mother)
- Relationships: Debra-narrator (aunt-nephew/niece), Marcus-narrator (cousins), Sandy-Marcus (mother-son), Sandy-narrator (aunt-nephew/niece), Debra-Sandy (sisters or sisters-in-law)
- Events: Parade attendance with family members

REMEMBER: Be thorough and inferential. Extract every person mentioned and build complete relationship webs from conversational fragments.

JSON OUTPUT STRUCTURE:
{
  "people": ["name with relationship and key details"],
  "dates": ["specific years, decades, or time periods mentioned"],
  "places": ["specific locations with context"],
  "relationships": ["nature of connections between people"],
  "events": ["significant life events with context"],
  "health_information": ["medical conditions, mental health, occupational hazards - flagged for privacy"],
  "uncertainties": ["details that need clarification"],
  "family_patterns": ["recurring themes across generations"]
}

PATTERN RECOGNITION:
- Identify family health patterns across generations
- Note social networks and community connections
- Track geographical movements and their contexts
- Recognize historical events and their personal impacts

QUALITY STANDARDS:
- Preserve exact names, nicknames, and titles as spoken
- Maintain emotional context around events
- Note sensory details that make memories vivid
- Respect the storyteller's perspective and voice

Remember: You're preserving family legacy with the same care and attention the family would want for their most precious memories.`;

// API Routes

// Collaborator agent endpoint
app.post('/api/collaborator', async (req, res) => {
    try {
        const { message, conversationHistory = [], model = 'claude-3-5-sonnet-20241022' } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required and must be a string' });
        }

        // Build conversation context
        const messages = [
            ...conversationHistory.slice(-6), // Keep last 6 messages for context
            {
                role: 'user',
                content: message
            }
        ];

        const response = await anthropic.messages.create({
            model: model,
            max_tokens: 1000,
            system: COLLABORATOR_SYSTEM_PROMPT,
            messages: messages
        });

        const collaboratorResponse = response.content[0].text;

        res.json({
            response: collaboratorResponse,
            agent: 'collaborator',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Collaborator API Error:', error);
        res.status(500).json({ 
            error: 'Failed to generate collaborator response',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Memory Keeper agent endpoint
app.post('/api/memory-keeper', async (req, res) => {
    try {
        const { message, model = 'claude-3-5-sonnet-20241022' } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'Message is required and must be a string' });
        }

        const response = await anthropic.messages.create({
            model: model,
            max_tokens: 500,
            system: MEMORY_KEEPER_SYSTEM_PROMPT,
            messages: [{
                role: 'user',
                content: `Extract structured memories from this message: "${message}"`
            }]
        });

        let extractedMemories;
        try {
            // Parse the JSON response from Claude
            extractedMemories = JSON.parse(response.content[0].text);
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            // Fallback to empty structure if parsing fails
            extractedMemories = {
                people: [],
                dates: [],
                places: [],
                relationships: [],
                events: []
            };
        }

        res.json({
            memories: extractedMemories,
            agent: 'memory-keeper',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Memory Keeper API Error:', error);
        res.status(500).json({ 
            error: 'Failed to extract memories',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        anthropicConfigured: !!process.env.ANTHROPIC_API_KEY
    });
});

// Serve the main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server Error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Story Collection server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🤖 Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Missing'}`);
    console.log(`🌐 Access at: http://localhost:${PORT}`);
});

module.exports = app;
