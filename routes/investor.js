const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All routes require Investor role (role_id = 3)
router.use(requireAuth);
router.use(requireRole(3));

// GET search projects by category and/or name
router.get('/search', async (req, res) => {
    const { category_id, title } = req.query;
    let query = `
        SELECT p.*, c.category_name, u.name AS entrepreneur_name,
               COALESCE(ft.total_collected, 0) AS total_collected,
               COALESCE(ft.remaining_amount, p.funding_goal) AS remaining_amount,
               ROUND(COALESCE(ft.total_collected, 0) / p.funding_goal * 100, 1) AS percent_funded
        FROM PROJECT p
        JOIN CATEGORY c ON p.category_id = c.category_id
        JOIN USERS u ON p.entrepreneur_id = u.user_id
        LEFT JOIN FUNDING_TRACKER ft ON p.project_id = ft.project_id
        WHERE p.status = 'Active' AND p.deadline >= CURDATE()
    `;
    const params = [];
    if (category_id) { query += ' AND p.category_id = ?'; params.push(category_id); }
    if (title) { query += ' AND p.title LIKE ?'; params.push(`%${title}%`); }
    query += ' ORDER BY p.created_at DESC';
    try {
        const [projects] = await db.query(query, params);
        res.json({ success: true, projects });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST invest in a project
router.post('/invest', async (req, res) => {
    const { project_id, amount } = req.body;
    const investor_id = req.session.user.user_id;
    if (!project_id || !amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Valid project and amount are required.' });
    }
    try {
        // Check project exists and is active
        const [[project]] = await db.query(
            `SELECT * FROM PROJECT WHERE project_id = ? AND status = 'Active' AND deadline >= CURDATE()`,
            [project_id]
        );
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found or no longer active.' });
        }
        // Insert investment
        await db.query(
            'INSERT INTO INVESTMENT (amount, project_id, investor_id) VALUES (?, ?, ?)',
            [amount, project_id, investor_id]
        );
        // Update funding tracker
        const [[tracker]] = await db.query(
            'SELECT * FROM FUNDING_TRACKER WHERE project_id = ?', [project_id]
        );
        if (tracker) {
            const newTotal = parseFloat(tracker.total_collected) + parseFloat(amount);
            const newRemaining = Math.max(0, parseFloat(project.funding_goal) - newTotal);
            await db.query(
                'UPDATE FUNDING_TRACKER SET total_collected = ?, remaining_amount = ? WHERE project_id = ?',
                [newTotal, newRemaining, project_id]
            );
            // Update project status if fully funded
            if (newTotal >= parseFloat(project.funding_goal)) {
                await db.query(`UPDATE PROJECT SET status = 'Funded' WHERE project_id = ?`, [project_id]);
            }
        } else {
            const newTotal = parseFloat(amount);
            const newRemaining = Math.max(0, parseFloat(project.funding_goal) - newTotal);
            await db.query(
                'INSERT INTO FUNDING_TRACKER (project_id, total_collected, remaining_amount) VALUES (?, ?, ?)',
                [project_id, newTotal, newRemaining]
            );
        }
        res.json({ success: true, message: `Successfully invested PKR ${parseFloat(amount).toLocaleString()}!` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET investor's investment history
router.get('/history', async (req, res) => {
    const investor_id = req.session.user.user_id;
    try {
        const [investments] = await db.query(`
            SELECT i.investment_id, i.amount, i.invested_at,
                   p.title AS project_title, p.status AS project_status,
                   c.category_name, u.name AS entrepreneur_name,
                   COALESCE(ft.total_collected, 0) AS total_collected,
                   p.funding_goal,
                   ROUND(COALESCE(ft.total_collected, 0) / p.funding_goal * 100, 1) AS percent_funded
            FROM INVESTMENT i
            JOIN PROJECT p ON i.project_id = p.project_id
            JOIN CATEGORY c ON p.category_id = c.category_id
            JOIN USERS u ON p.entrepreneur_id = u.user_id
            LEFT JOIN FUNDING_TRACKER ft ON p.project_id = ft.project_id
            WHERE i.investor_id = ?
            ORDER BY i.invested_at DESC
        `, [investor_id]);
        res.json({ success: true, investments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET investor stats
router.get('/stats', async (req, res) => {
    const investor_id = req.session.user.user_id;
    try {
        const [[stats]] = await db.query(`
            SELECT
                COUNT(i.investment_id) AS total_investments,
                COALESCE(SUM(i.amount), 0) AS total_invested,
                COUNT(DISTINCT i.project_id) AS projects_backed,
                COUNT(CASE WHEN p.status = 'Funded' THEN 1 END) AS successful_projects
            FROM INVESTMENT i
            JOIN PROJECT p ON i.project_id = p.project_id
            WHERE i.investor_id = ?
        `, [investor_id]);
        res.json({ success: true, stats });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
