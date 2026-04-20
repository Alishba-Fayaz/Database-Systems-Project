const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All routes require Entrepreneur role (role_id = 2)
router.use(requireAuth);
router.use(requireRole(2));

// GET entrepreneur's own projects with funding info
router.get('/projects', async (req, res) => {
    const entrepreneur_id = req.session.user.user_id;
    try {
        const [projects] = await db.query(`
            SELECT p.*, c.category_name,
                   COALESCE(ft.total_collected, 0) AS total_collected,
                   COALESCE(ft.remaining_amount, p.funding_goal) AS remaining_amount,
                   ft.last_updated,
                   ROUND(COALESCE(ft.total_collected, 0) / p.funding_goal * 100, 1) AS percent_funded
            FROM PROJECT p
            JOIN CATEGORY c ON p.category_id = c.category_id
            LEFT JOIN FUNDING_TRACKER ft ON p.project_id = ft.project_id
            WHERE p.entrepreneur_id = ?
            ORDER BY p.created_at DESC
        `, [entrepreneur_id]);
        res.json({ success: true, projects });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST create new project
router.post('/projects', async (req, res) => {
    const { title, description, funding_goal, deadline, category_id } = req.body;
    const entrepreneur_id = req.session.user.user_id;
    if (!title || !funding_goal || !deadline || !category_id) {
        return res.status(400).json({ success: false, message: 'All required fields must be filled.' });
    }
    if (parseFloat(funding_goal) <= 0) {
        return res.status(400).json({ success: false, message: 'Funding goal must be positive.' });
    }
    try {
        const [result] = await db.query(
            `INSERT INTO PROJECT (title, description, funding_goal, deadline, entrepreneur_id, category_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [title, description, funding_goal, deadline, entrepreneur_id, category_id]
        );
        // Initialize funding tracker
        await db.query(
            `INSERT INTO FUNDING_TRACKER (project_id, total_collected, remaining_amount)
             VALUES (?, 0, ?)`,
            [result.insertId, funding_goal]
        );
        res.json({ success: true, message: 'Project created successfully!', project_id: result.insertId });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET investment details for a specific project
router.get('/projects/:id/investments', async (req, res) => {
    const entrepreneur_id = req.session.user.user_id;
    const project_id = req.params.id;
    try {
        const [investments] = await db.query(`
            SELECT i.investment_id, i.amount, i.invested_at, u.name AS investor_name
            FROM INVESTMENT i
            JOIN USERS u ON i.investor_id = u.user_id
            WHERE i.project_id = ?
            AND (SELECT entrepreneur_id FROM PROJECT WHERE project_id = ?) = ?
            ORDER BY i.invested_at DESC
        `, [project_id, project_id, entrepreneur_id]);
        res.json({ success: true, investments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET dashboard summary stats
router.get('/stats', async (req, res) => {
    const entrepreneur_id = req.session.user.user_id;
    try {
        const [[stats]] = await db.query(`
            SELECT
                COUNT(p.project_id) AS total_projects,
                SUM(COALESCE(ft.total_collected, 0)) AS total_raised,
                COUNT(CASE WHEN p.status = 'Active' THEN 1 END) AS active_projects,
                COUNT(CASE WHEN p.status = 'Funded' THEN 1 END) AS funded_projects
            FROM PROJECT p
            LEFT JOIN FUNDING_TRACKER ft ON p.project_id = ft.project_id
            WHERE p.entrepreneur_id = ?
        `, [entrepreneur_id]);
        res.json({ success: true, stats });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
