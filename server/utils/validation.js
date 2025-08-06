/**
 * Validation utilities for API endpoints
 */

/**
 * Validate input data against common patterns
 */
function validateInput(data, rules) {
    const errors = [];
    
    for (const [field, rule] of Object.entries(rules)) {
        const value = data[field];
        
        if (rule.required && (value === undefined || value === null || value === '')) {
            errors.push(`${field} is required`);
            continue;
        }
        
        if (value !== undefined && value !== null) {
            if (rule.type === 'string' && typeof value !== 'string') {
                errors.push(`${field} must be a string`);
            }
            
            if (rule.type === 'number' && typeof value !== 'number') {
                errors.push(`${field} must be a number`);
            }
            
            if (rule.type === 'boolean' && typeof value !== 'boolean') {
                errors.push(`${field} must be a boolean`);
            }
            
            if (rule.minLength && value.length < rule.minLength) {
                errors.push(`${field} must be at least ${rule.minLength} characters`);
            }
            
            if (rule.maxLength && value.length > rule.maxLength) {
                errors.push(`${field} must be no more than ${rule.maxLength} characters`);
            }
            
            if (rule.pattern && !rule.pattern.test(value)) {
                errors.push(`${field} format is invalid`);
            }
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Create standardized error response
 */
function createErrorResponse(error, statusCode = 500) {
    // Sanitize error messages for production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    let message = 'An error occurred';
    
    if (error instanceof Error) {
        // Use error message for known error types
        if (error.message.includes('required') || 
            error.message.includes('invalid') || 
            error.message.includes('not found') ||
            error.message.includes('too long') ||
            error.message.includes('cannot be empty')) {
            message = error.message;
        } else if (isDevelopment) {
            message = error.message;
        }
    } else if (typeof error === 'string') {
        message = error;
    }
    
    const response = {
        error: true,
        message,
        timestamp: new Date().toISOString()
    };
    
    // Include stack trace in development
    if (isDevelopment && error instanceof Error && error.stack) {
        response.stack = error.stack;
    }
    
    return response;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    if (!email || typeof email !== 'string') {
        return false;
    }
    
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

/**
 * Validate conversation title
 */
function isValidConversationTitle(title) {
    if (!title || typeof title !== 'string') {
        return false;
    }
    
    const trimmed = title.trim();
    return trimmed.length > 0 && trimmed.length <= 500;
}

/**
 * Validate message content
 */
function isValidMessageContent(content) {
    if (!content || typeof content !== 'string') {
        return false;
    }
    
    const trimmed = content.trim();
    return trimmed.length > 0 && trimmed.length <= 10000; // 10k character limit
}

/**
 * Sanitize user input to prevent XSS
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return input;
    }
    
    return input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Validate pagination parameters
 */
function validatePagination(query) {
    const limit = parseInt(query.limit) || 20;
    const offset = parseInt(query.offset) || 0;
    
    return {
        limit: Math.min(Math.max(limit, 1), 100), // Between 1 and 100
        offset: Math.max(offset, 0) // Non-negative
    };
}

module.exports = {
    validateInput,
    createErrorResponse,
    isValidEmail,
    isValidConversationTitle,
    isValidMessageContent,
    sanitizeInput,
    validatePagination
};
