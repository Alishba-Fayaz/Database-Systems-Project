// Middleware to check if user is authenticated
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }
    next();
}

// Middleware to check role
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ success: false, message: 'Unauthorized.' });
        }
        if (!roles.includes(req.session.user.role_id)) {
            return res.status(403).json({ success: false, message: 'Forbidden. Insufficient permissions.' });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };
