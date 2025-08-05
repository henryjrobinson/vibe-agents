/**
 * Input Validation and Security Utilities for API Endpoints
 * Provides comprehensive validation, sanitization, and security checks
 */

// Security constants
const SECURITY_LIMITS = {
    MAX_MESSAGE_LENGTH: 10000,      // 10KB max message
    MAX_CONVERSATION_HISTORY: 20,   // Max conversation history items
    MAX_REQUEST_SIZE: 50000,        // 50KB max total request
    MIN_MESSAGE_LENGTH: 1,          // Minimum message length
    MAX_MODEL_NAME_LENGTH: 100,     // Max model name length
    ALLOWED_HTTP_METHODS: ['POST', 'OPTIONS']
};

// Allowed origins for CORS (production whitelist)
const ALLOWED_ORIGINS = [
    'https://vibe-agents.netlify.app',
    'https://main--vibe-agents.netlify.app',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
    'file://' // For local testing
];

// Allowed Claude models (whitelist)
const ALLOWED_MODELS = [
    'claude-3-haiku-20240307',
    'claude-3-sonnet-20240229', 
    'claude-3-opus-20240229',
    'claude-3-5-haiku-20241022',
    'claude-3-5-sonnet-20241022',
    'claude-opus-4-20250514'
];

/**
 * Validate and get secure CORS origin
 */
function getSecureCorsOrigin(event) {
    const origin = event.headers.origin || event.headers.Origin;
    
    // If no origin (same-origin request), allow it - this is normal for API calls from same domain
    if (!origin) {
        console.log('Same-origin request detected (no origin header) - allowing');
        return null;
    }
    
    console.log('Cross-origin request detected, origin:', origin);
    
    // Check if origin is in whitelist
    const isAllowed = ALLOWED_ORIGINS.some(allowedOrigin => {
        if (allowedOrigin === 'file://') {
            return origin.startsWith('file://');
        }
        return origin === allowedOrigin;
    });
    
    if (!isAllowed) {
        console.error('Origin not in whitelist:', origin, 'Allowed origins:', ALLOWED_ORIGINS);
        throw new ValidationError(`Origin ${origin} not allowed`, 403);
    }
    
    console.log('Origin allowed:', origin);
    return origin;
}

/**
 * Validate HTTP method
 */
function validateHttpMethod(method) {
    if (!SECURITY_LIMITS.ALLOWED_HTTP_METHODS.includes(method)) {
        throw new ValidationError(`Method ${method} not allowed`, 405);
    }
}

/**
 * Validate request size
 */
function validateRequestSize(body) {
    if (!body) {
        throw new ValidationError('Request body is required', 400);
    }
    
    const bodySize = Buffer.byteLength(body, 'utf8');
    if (bodySize > SECURITY_LIMITS.MAX_REQUEST_SIZE) {
        throw new ValidationError(`Request too large: ${bodySize} bytes (max: ${SECURITY_LIMITS.MAX_REQUEST_SIZE})`, 413);
    }
}

/**
 * Validate and sanitize message input
 */
function validateMessage(message) {
    // Check if message exists
    if (!message) {
        throw new ValidationError('Message is required', 400);
    }
    
    // Check message type
    if (typeof message !== 'string') {
        throw new ValidationError('Message must be a string', 400);
    }
    
    // Check message length
    if (message.length < SECURITY_LIMITS.MIN_MESSAGE_LENGTH) {
        throw new ValidationError('Message cannot be empty', 400);
    }
    
    if (message.length > SECURITY_LIMITS.MAX_MESSAGE_LENGTH) {
        throw new ValidationError(`Message too long: ${message.length} characters (max: ${SECURITY_LIMITS.MAX_MESSAGE_LENGTH})`, 413);
    }
    
    // Sanitize message - remove potential script injections
    const sanitized = message
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/javascript:/gi, '')                                        // Remove javascript: protocols
        .replace(/on\w+\s*=/gi, '')                                         // Remove event handlers
        .trim();
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
        /eval\s*\(/i,
        /function\s*\(/i,
        /setTimeout\s*\(/i,
        /setInterval\s*\(/i,
        /<iframe/i,
        /<object/i,
        /<embed/i
    ];
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(sanitized)) {
            throw new ValidationError('Message contains potentially malicious content', 400);
        }
    }
    
    return sanitized;
}

/**
 * Validate Claude model name
 */
function validateModel(model) {
    if (!model) {
        return ALLOWED_MODELS[ALLOWED_MODELS.length - 1]; // Default to latest
    }
    
    if (typeof model !== 'string') {
        throw new ValidationError('Model must be a string', 400);
    }
    
    if (model.length > SECURITY_LIMITS.MAX_MODEL_NAME_LENGTH) {
        throw new ValidationError('Model name too long', 400);
    }
    
    if (!ALLOWED_MODELS.includes(model)) {
        throw new ValidationError(`Invalid model: ${model}. Allowed models: ${ALLOWED_MODELS.join(', ')}`, 400);
    }
    
    return model;
}

/**
 * Validate conversation history
 */
function validateConversationHistory(history) {
    if (!history) {
        return [];
    }
    
    if (!Array.isArray(history)) {
        throw new ValidationError('Conversation history must be an array', 400);
    }
    
    if (history.length > SECURITY_LIMITS.MAX_CONVERSATION_HISTORY) {
        throw new ValidationError(`Too many conversation history items: ${history.length} (max: ${SECURITY_LIMITS.MAX_CONVERSATION_HISTORY})`, 413);
    }
    
    // Validate each history item
    const validatedHistory = history.map((item, index) => {
        if (!item || typeof item !== 'object') {
            throw new ValidationError(`Invalid conversation history item at index ${index}`, 400);
        }
        
        if (!item.role || !item.content) {
            throw new ValidationError(`Missing role or content in conversation history item ${index}`, 400);
        }
        
        if (!['user', 'assistant'].includes(item.role)) {
            throw new ValidationError(`Invalid role "${item.role}" in conversation history item ${index}`, 400);
        }
        
        if (typeof item.content !== 'string') {
            throw new ValidationError(`Content must be string in conversation history item ${index}`, 400);
        }
        
        if (item.content.length > SECURITY_LIMITS.MAX_MESSAGE_LENGTH) {
            throw new ValidationError(`Content too long in conversation history item ${index}`, 413);
        }
        
        return {
            role: item.role,
            content: validateMessage(item.content)
        };
    });
    
    return validatedHistory;
}

/**
 * Parse and validate JSON request body
 */
function parseAndValidateBody(body) {
    try {
        return JSON.parse(body);
    } catch (error) {
        throw new ValidationError('Invalid JSON in request body', 400);
    }
}

/**
 * Custom validation error class
 */
class ValidationError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = statusCode;
    }
}

/**
 * Main validation function for API requests
 */
function validateApiRequest(event) {
    // Validate CORS origin first
    const allowedOrigin = getSecureCorsOrigin(event);
    
    // Validate HTTP method
    validateHttpMethod(event.httpMethod);
    
    // Handle OPTIONS requests (CORS preflight)
    if (event.httpMethod === 'OPTIONS') {
        return {
            isValid: true,
            isOptions: true,
            allowedOrigin
        };
    }
    
    // Validate request size
    validateRequestSize(event.body);
    
    // Parse and validate JSON body
    const parsedBody = parseAndValidateBody(event.body);
    
    // Validate required fields
    const message = validateMessage(parsedBody.message);
    const model = validateModel(parsedBody.model);
    const conversationHistory = validateConversationHistory(parsedBody.conversationHistory);
    
    return {
        isValid: true,
        isOptions: false,
        allowedOrigin,
        validatedData: {
            message,
            model,
            conversationHistory
        }
    };
}

/**
 * Create standardized error response with secure CORS
 */
function createErrorResponse(error, allowedOrigin = null) {
    const statusCode = error.statusCode || 500;
    const message = error.name === 'ValidationError' ? error.message : 'Internal server error';
    
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    
    // Only set CORS origin if it's whitelisted
    if (allowedOrigin) {
        headers['Access-Control-Allow-Origin'] = allowedOrigin;
    }
    
    return {
        statusCode,
        headers,
        body: JSON.stringify({
            error: message,
            timestamp: new Date().toISOString()
        })
    };
}

/**
 * Create standardized CORS response for OPTIONS requests with secure origin
 */
function createOptionsResponse(allowedOrigin = null) {
    const headers = {
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Max-Age': '86400' // 24 hours
    };
    
    // Only set CORS origin if it's whitelisted
    if (allowedOrigin) {
        headers['Access-Control-Allow-Origin'] = allowedOrigin;
    }
    
    return {
        statusCode: 200,
        headers,
        body: ''
    };
}

/**
 * Create secure CORS headers for successful responses
 */
function createSecureCorsHeaders(allowedOrigin = null) {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };
    
    // Only set CORS origin if it's whitelisted
    if (allowedOrigin) {
        headers['Access-Control-Allow-Origin'] = allowedOrigin;
    }
    
    return headers;
}

module.exports = {
    validateApiRequest,
    createErrorResponse,
    createOptionsResponse,
    createSecureCorsHeaders,
    getSecureCorsOrigin,
    ValidationError,
    SECURITY_LIMITS,
    ALLOWED_MODELS,
    ALLOWED_ORIGINS
};
