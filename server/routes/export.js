const express = require('express');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// All export routes require authentication
router.use(authenticateUser);

// Placeholder routes - will be implemented in Phase 4
router.get('/conversation/:id', (req, res) => {
    res.json({ 
        message: 'Export conversation - Coming in Phase 4',
        timestamp: new Date().toISOString()
    });
});

router.get('/memories', (req, res) => {
    res.json({ 
        message: 'Export memories - Coming in Phase 4',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
