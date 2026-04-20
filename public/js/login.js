// ============================================
// VentureFlow — Login / Signup Logic
// ============================================

const tabs = document.querySelectorAll('.auth-tab');

function switchTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    tabs.forEach(t => t.classList.remove('active'));

    if (tab === 'login') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        tabs[0].classList.add('active');
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        tabs[1].classList.add('active');
        loadRoles();
    }
}

// Allow pressing Enter in inputs
document.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        const loginForm = document.getElementById('loginForm');
        if (loginForm.style.display !== 'none') {
            handleLogin();
        } else {
            handleSignup();
        }
    }
});

function showAlert(id, message, type = 'error') {
    const el = document.getElementById(id);
    el.className = `alert alert-${type} show`;
    el.innerHTML = (type === 'error' ? '⚠️ ' : '✅ ') + message;
    setTimeout(() => el.classList.remove('show'), 5000);
}

function setLoading(btnId, loading, label = '') {
    const btn = document.getElementById(btnId);
    if (loading) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span>';
    } else {
        btn.disabled = false;
        btn.innerHTML = label;
    }
}

async function loadRoles() {
    const select = document.getElementById('signupRole');
    if (select.children.length > 1) return; // already loaded
    try {
        const res = await fetch('/api/auth/roles');
        const data = await res.json();
        if (data.success) {
            data.roles.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.role_id;
                opt.textContent = r.role_name;
                select.appendChild(opt);
            });
        }
    } catch (e) {
        console.error('Failed to load roles:', e);
    }
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) {
        showAlert('loginAlert', 'Please enter your email and password.');
        return;
    }
    setLoading('loginBtn', true);
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            showAlert('loginAlert', 'Login successful! Redirecting...', 'success');
            setTimeout(() => window.location.href = data.redirect, 800);
        } else {
            showAlert('loginAlert', data.message || 'Login failed.');
            setLoading('loginBtn', false, 'Sign In');
        }
    } catch (e) {
        showAlert('loginAlert', 'Server error. Make sure the backend is running.');
        setLoading('loginBtn', false, 'Sign In');
    }
}

async function handleSignup() {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const role_id = document.getElementById('signupRole').value;

    if (!name || !email || !password || !role_id) {
        showAlert('signupAlert', 'All fields are required.');
        return;
    }
    if (password.length < 6) {
        showAlert('signupAlert', 'Password must be at least 6 characters.');
        return;
    }

    setLoading('signupBtn', true);
    try {
        const res = await fetch('/api/auth/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role_id })
        });
        const data = await res.json();
        if (data.success) {
            showAlert('signupAlert', data.message, 'success');
            setTimeout(() => switchTab('login'), 1500);
        } else {
            showAlert('signupAlert', data.message || 'Sign up failed.');
        }
        setLoading('signupBtn', false, 'Create Account');
    } catch (e) {
        showAlert('signupAlert', 'Server error. Make sure the backend is running.');
        setLoading('signupBtn', false, 'Create Account');
    }
}

// Check if already logged in
(async () => {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success) {
            const role = data.user.role_id;
            if (role === 2) window.location.href = '/entrepreneur';
            else if (role === 3) window.location.href = '/investor';
            else window.location.href = '/dashboard';
        }
    } catch (e) { /* not logged in */ }
})();
