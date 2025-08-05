const express = require('express');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// All message routes require authentication
router.use(authenticateUser);

// Placeholder routes - will be implemented in Phase 2
router.get('/', (req, res) => {
    res.json({ 
        message: 'Messages API - Coming in Phase 2',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
