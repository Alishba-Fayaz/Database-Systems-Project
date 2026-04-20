const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All routes require Ordinary User role (role_id = 1)
router.use(requireAuth);
router.use(requireRole(1));

// GET user's verification status
router.get('/verification', async (req, res) => {
    const user_id = req.session.user.user_id;
    try {
        const [rows] = await db.query('SELECT * FROM VERIFICATION WHERE user_id = ?', [user_id]);
        res.json({ success: true, verification: rows.length > 0 ? rows[0] : null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST submit verification details
router.post('/verification', async (req, res) => {
    const { id_type, id_number } = req.body;
    const user_id = req.session.user.user_id;
    if (!id_type || !id_number) {
        return res.status(400).json({ success: false, message: 'ID type and number are required.' });
    }
    try {
        // Check if already submitted
        const [existing] = await db.query('SELECT verification_id FROM VERIFICATION WHERE user_id = ?', [user_id]);
        if (existing.length > 0) {
            // Update existing
            await db.query(
                'UPDATE VERIFICATION SET id_type = ?, id_number = ?, status = ? WHERE user_id = ?',
                [id_type, id_number, 'Pending', user_id]
            );
            return res.json({ success: true, message: 'Verification details updated. Status reset to Pending.' });
        }
        await db.query(
            'INSERT INTO VERIFICATION (user_id, id_type, id_number) VALUES (?, ?, ?)',
            [user_id, id_type, id_number]
        );
        res.json({ success: true, message: 'Verification submitted successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET active projects for browsing
router.get('/projects', async (req, res) => {
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

// POST fund a project (ordinary user contribution)
router.post('/fund', async (req, res) => {
    const { project_id, amount } = req.body;
    const user_id = req.session.user.user_id;
    if (!project_id || !amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ success: false, message: 'Valid project and amount required.' });
    }
    try {
        const [[project]] = await db.query(
            `SELECT * FROM PROJECT WHERE project_id = ? AND status = 'Active' AND deadline >= CURDATE()`,
            [project_id]
        );
        if (!project) {
            return res.status(404).json({ success: false, message: 'Project not found or no longer active.' });
        }
        await db.query(
            'INSERT INTO INVESTMENT (amount, project_id, investor_id) VALUES (?, ?, ?)',
            [amount, project_id, user_id]
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
            if (newTotal >= parseFloat(project.funding_goal)) {
                await db.query(`UPDATE PROJECT SET status = 'Funded' WHERE project_id = ?`, [project_id]);
            }
        } else {
            const newTotal = parseFloat(amount);
            await db.query(
                'INSERT INTO FUNDING_TRACKER (project_id, total_collected, remaining_amount) VALUES (?, ?, ?)',
                [project_id, newTotal, Math.max(0, project.funding_goal - newTotal)]
            );
        }
        res.json({ success: true, message: 'Funding submitted successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET user's funding history
router.get('/history', async (req, res) => {
    const user_id = req.session.user.user_id;
    try {
        const [history] = await db.query(`
            SELECT i.investment_id, i.amount, i.invested_at,
                   p.title AS project_title, p.status AS project_status,
                   c.category_name
            FROM INVESTMENT i
            JOIN PROJECT p ON i.project_id = p.project_id
            JOIN CATEGORY c ON p.category_id = c.category_id
            WHERE i.investor_id = ?
            ORDER BY i.invested_at DESC
        `, [user_id]);
        res.json({ success: true, history });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
