const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const entrepreneurRoutes = require('./routes/entrepreneur');
const investorRoutes = require('./routes/investor');
const userRoutes = require('./routes/user');
const commonRoutes = require('./routes/common');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'entrepreneur_funding_secret_2024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/entrepreneur', entrepreneurRoutes);
app.use('/api/investor', investorRoutes);
app.use('/api/user', userRoutes);
app.use('/api/common', commonRoutes);

// Page routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/entrepreneur', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'entrepreneur_dashboard.html')));
app.get('/investor', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'investor_dashboard.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'user_dashboard.html')));

// API health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Server is running' }));

app.listen(PORT, () => {
    console.log(`\nEntrepreneur Funding Platform`);
    console.log(`   Server running at: http://localhost:${PORT}`);
    console.log(`   Open your browser and navigate to the URL above.\n`);
});
