const express = require('express');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// All conversation routes require authentication
router.use(authenticateUser);

// Placeholder routes - will be implemented in Phase 2
router.get('/', (req, res) => {
    res.json({ 
        message: 'Conversations API - Coming in Phase 2',
        timestamp: new Date().toISOString()
    });
});

router.post('/', (req, res) => {
    res.json({ 
        message: 'Create conversation - Coming in Phase 2',
        timestamp: new Date().toISOString()
    });
});

router.get('/:id', (req, res) => {
    res.json({ 
        message: 'Get conversation - Coming in Phase 2',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
