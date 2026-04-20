const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET all categories
router.get('/categories', async (req, res) => {
    try {
        const [categories] = await db.query('SELECT * FROM CATEGORY ORDER BY category_name');
        res.json({ success: true, categories });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
