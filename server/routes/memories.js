const express = require('express');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// All memory routes require authentication
router.use(authenticateUser);

// Placeholder routes - will be implemented in Phase 3
router.get('/', (req, res) => {
    res.json({ 
        message: 'Memories API - Coming in Phase 3',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
