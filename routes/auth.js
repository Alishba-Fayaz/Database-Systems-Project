const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

// GET roles for signup dropdown
router.get('/roles', async (req, res) => {
    try {
        const [roles] = await db.query('SELECT * FROM ROLE');
        res.json({ success: true, roles });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST signup
router.post('/signup', async (req, res) => {
    const { name, email, password, role_id } = req.body;
    if (!name || !email || !password || !role_id) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    try {
        const [existing] = await db.query('SELECT user_id FROM USERS WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Email already registered.' });
        }
        const hashed = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO USERS (name, email, password, role_id) VALUES (?, ?, ?, ?)',
            [name, email, hashed, role_id]
        );
        res.json({ success: true, message: 'Account created successfully. Please log in.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    try {
        const [users] = await db.query(
            'SELECT u.*, r.role_name FROM USERS u JOIN ROLE r ON u.role_id = r.role_id WHERE u.email = ?',
            [email]
        );
        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }
        const user = users[0];
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }
        req.session.user = {
            user_id: user.user_id,
            name: user.name,
            email: user.email,
            role_id: user.role_id,
            role_name: user.role_name
        };
        // Determine redirect path based on role
        let redirect = '/dashboard';
        if (user.role_id === 2) redirect = '/entrepreneur';
        if (user.role_id === 3) redirect = '/investor';

        res.json({ success: true, redirect, user: req.session.user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out.' });
});

// GET current session user
router.get('/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ success: true, user: req.session.user });
    } else {
        res.status(401).json({ success: false, message: 'Not authenticated.' });
    }
});

module.exports = router;
