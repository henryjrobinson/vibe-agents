const express = require('express');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// All search routes require authentication
router.use(authenticateUser);

// Placeholder routes - will be implemented in Phase 4
router.get('/conversations', (req, res) => {
    res.json({ 
        message: 'Search conversations - Coming in Phase 4',
        timestamp: new Date().toISOString()
    });
});

router.get('/memories', (req, res) => {
    res.json({ 
        message: 'Search memories - Coming in Phase 4',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
