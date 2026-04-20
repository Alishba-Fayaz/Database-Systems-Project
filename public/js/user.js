// ============================================
// VentureFlow — Ordinary User Dashboard
// ============================================

let currentUser = null;
let categories = [];
let selectedProjectId = null;

(async () => {
    await checkAuth();
    await loadVerificationStatus();
    await loadCategories();
    await loadFeaturedProjects();
    await loadOverviewStats();
})();

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.success || data.user.role_id !== 1) {
            window.location.href = '/';
            return;
        }
        currentUser = data.user;
        document.getElementById('sidebarName').textContent = currentUser.name;
        document.getElementById('sidebarAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
    } catch (e) {
        window.location.href = '/';
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
}

function navigate(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('sec-' + section).classList.add('active');
    event.currentTarget.classList.add('active');
    const titles = {
        overview: 'Overview', verification: 'Identity Verification',
        browse: 'Browse Projects', history: 'My Contributions'
    };
    document.getElementById('topbarTitle').textContent = titles[section] || section;
    if (section === 'verification') loadVerificationStatus();
    if (section === 'browse') loadBrowseProjects();
    if (section === 'history') loadHistory();
}

async function loadVerificationStatus() {
    const statusDiv = document.getElementById('verificationStatus');
    if (!statusDiv) return;
    try {
        const res = await fetch('/api/user/verification');
        const data = await res.json();
        const v = data.verification;
        const badge = document.getElementById('verificationBadge');
        const statEl = document.getElementById('stat-verify-status');
        const nudge = document.getElementById('verificationNudge');
        const formPanel = document.getElementById('verificationFormPanel');

        if (!v) {
            statusDiv.innerHTML = buildVerificationCard('none', '🪪', 'Not Submitted', 'You have not submitted any verification details yet.');
            if (badge) badge.innerHTML = '<span style="color:var(--red);background:var(--red-dim);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;">⚠ Unverified</span>';
            if (statEl) statEl.textContent = 'Unverified';
            if (nudge) nudge.style.display = 'block';
            if (formPanel) formPanel.style.display = 'block';
        } else if (v.status === 'Pending') {
            statusDiv.innerHTML = buildVerificationCard('pending', '⏳', 'Pending Review', 'Your ' + v.id_type + ' (' + v.id_number + ') is under review.');
            if (badge) badge.innerHTML = '<span style="color:var(--gold);background:var(--gold-soft);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;">⏳ Pending</span>';
            if (statEl) statEl.textContent = 'Pending';
            if (formPanel) formPanel.style.display = 'block';
        } else if (v.status === 'Approved') {
            statusDiv.innerHTML = buildVerificationCard('approved', '✅', 'Verified', 'Your ' + v.id_type + ' has been approved. You have full platform access.');
            if (badge) badge.innerHTML = '<span style="color:var(--green);background:var(--green-dim);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;">✅ Verified</span>';
            if (statEl) statEl.textContent = 'Verified';
            if (nudge) nudge.style.display = 'none';
            if (formPanel) formPanel.style.display = 'none';
        } else if (v.status === 'Rejected') {
            statusDiv.innerHTML = buildVerificationCard('rejected', '❌', 'Rejected', 'Your verification was rejected. Please re-submit with correct details.');
            if (badge) badge.innerHTML = '<span style="color:var(--red);background:var(--red-dim);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:600;">❌ Rejected</span>';
            if (statEl) statEl.textContent = 'Rejected';
            if (formPanel) formPanel.style.display = 'block';
        }
    } catch (e) { console.error(e); }
}

function buildVerificationCard(type, icon, title, desc) {
    return '<div class="verification-card"><div class="verification-icon ' + type + '">' + icon + '</div><div class="verification-info"><h3>' + title + '</h3><p>' + desc + '</p></div></div>';
}

async function submitVerification() {
    const id_type = document.getElementById('idType').value;
    const id_number = document.getElementById('idNumber').value.trim();
    if (!id_type || !id_number) {
        showAlert('verifyAlert', 'Please select an ID type and enter your ID number.', 'error');
        return;
    }
    const btn = document.getElementById('verifyBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
        const res = await fetch('/api/user/verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_type, id_number })
        });
        const data = await res.json();
        if (data.success) {
            showAlert('verifyAlert', data.message, 'success');
            await loadVerificationStatus();
        } else {
            showAlert('verifyAlert', data.message, 'error');
        }
    } catch (e) {
        showAlert('verifyAlert', 'Server error.', 'error');
    }
    btn.disabled = false;
    btn.innerHTML = 'Submit for Review';
}

async function loadCategories() {
    if (categories.length > 0) return;
    try {
        const res = await fetch('/api/common/categories');
        const data = await res.json();
        if (data.success) {
            categories = data.categories;
            const sel = document.getElementById('browseCategory');
            if (!sel) return;
            categories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.category_id;
                opt.textContent = c.category_name;
                sel.appendChild(opt);
            });
        }
    } catch (e) { console.error(e); }
}

async function loadOverviewStats() {
    try {
        const res = await fetch('/api/user/history');
        const data = await res.json();
        if (data.success) {
            const total = data.history.reduce((sum, i) => sum + parseFloat(i.amount), 0);
            const projects = new Set(data.history.map(i => i.project_title)).size;
            document.getElementById('stat-contributed').textContent = 'PKR ' + formatCurrency(total);
            document.getElementById('stat-projects-supported').textContent = projects;
        }
    } catch (e) { console.error(e); }
}

async function loadFeaturedProjects() {
    const container = document.getElementById('featuredProjects');
    try {
        const res = await fetch('/api/user/projects');
        const data = await res.json();
        if (!data.success || data.projects.length === 0) {
            container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">🌐</span><p>No active projects at the moment.</p></div>';
            return;
        }
        container.innerHTML = data.projects.slice(0, 3).map(p => renderProjectCard(p)).join('');
    } catch (e) {
        container.innerHTML = '<div class="text-dim" style="grid-column:1/-1">Failed to load.</div>';
    }
}

async function loadBrowseProjects(params) {
    params = params || {};
    const container = document.getElementById('browseGrid');
    container.innerHTML = '<div class="loading-center" style="grid-column:1/-1"><div class="spinner"></div></div>';
    try {
        const query = new URLSearchParams(params).toString();
        const res = await fetch('/api/user/projects?' + query);
        const data = await res.json();
        if (!data.success || data.projects.length === 0) {
            container.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="empty-icon">🔍</span><p>No projects found.</p></div>';
            return;
        }
        container.innerHTML = data.projects.map(p => renderProjectCard(p)).join('');
    } catch (e) {
        container.innerHTML = '<div class="text-dim" style="grid-column:1/-1">Failed to load.</div>';
    }
}

function browseProjects() {
    const title = document.getElementById('browseSearch').value.trim();
    const category_id = document.getElementById('browseCategory').value;
    const params = {};
    if (title) params.title = title;
    if (category_id) params.category_id = category_id;
    loadBrowseProjects(params);
}

function clearBrowse() {
    document.getElementById('browseSearch').value = '';
    document.getElementById('browseCategory').value = '';
    loadBrowseProjects();
}

function renderProjectCard(p) {
    const pct = Math.min(100, parseFloat(p.percent_funded) || 0);
    return '<div class="project-card">' +
        '<div class="project-card-top"><span class="project-category-tag">' + escHtml(p.category_name) + '</span><span class="status-badge active">Active</span></div>' +
        '<div class="project-title">' + escHtml(p.title) + '</div>' +
        '<div class="project-desc">' + escHtml(p.description || 'No description provided.') + '</div>' +
        '<div class="project-entrepreneur">👤 By ' + escHtml(p.entrepreneur_name) + '</div>' +
        '<div class="progress-section"><div class="progress-meta"><span class="progress-amount">PKR ' + formatCurrency(p.total_collected) + '</span><span class="progress-pct">' + pct + '%</span></div>' +
        '<div class="progress-bar"><div class="progress-fill ' + (pct >= 100 ? 'full' : '') + '" style="width:' + pct + '%"></div></div></div>' +
        '<div class="project-footer" style="margin-bottom:14px;"><span class="project-deadline">📅 ' + formatDate(p.deadline) + '</span><span class="project-goal">Goal: <span>PKR ' + formatCurrency(p.funding_goal) + '</span></span></div>' +
        '<button class="btn btn-primary" style="width:100%;" onclick="openFundModal(' + p.project_id + ', \'' + escHtml(p.title) + '\', ' + p.funding_goal + ', ' + p.total_collected + ', ' + pct + ')">🌱 Support Project</button>' +
        '</div>';
}

async function loadHistory() {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = '<tr><td colspan="5"><div class="loading-center"><div class="spinner"></div></div></td></tr>';
    try {
        const res = await fetch('/api/user/history');
        const data = await res.json();
        if (!data.success || data.history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><span class="empty-icon">📜</span><p>No contributions yet.</p></div></td></tr>';
            return;
        }
        tbody.innerHTML = data.history.map(i =>
            '<tr><td class="td-main">' + escHtml(i.project_title) + '</td>' +
            '<td>' + escHtml(i.category_name) + '</td>' +
            '<td class="td-gold">' + formatCurrency(i.amount) + '</td>' +
            '<td><span class="status-badge ' + i.project_status.toLowerCase() + '">' + i.project_status + '</span></td>' +
            '<td>' + formatDate(i.invested_at) + '</td></tr>'
        ).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-dim">Failed to load.</td></tr>';
    }
}

function openFundModal(projectId, title, goal, collected, pct) {
    selectedProjectId = projectId;
    document.getElementById('fundProjectInfo').innerHTML =
        '<div class="project-title" style="margin-bottom:8px;">' + escHtml(title) + '</div>' +
        '<div style="margin-bottom:8px;"><div class="progress-meta"><span style="font-size:0.85rem;color:var(--text-2);">PKR ' + formatCurrency(collected) + ' raised</span><span class="progress-pct">' + pct + '%</span></div>' +
        '<div class="progress-bar" style="margin-top:6px;"><div class="progress-fill" style="width:' + pct + '%"></div></div></div>' +
        '<div style="font-size:0.82rem;color:var(--text-3);">Goal: <strong style="color:var(--text);">PKR ' + formatCurrency(goal) + '</strong> &nbsp;|&nbsp; Remaining: <strong style="color:var(--gold);">PKR ' + formatCurrency(parseFloat(goal) - parseFloat(collected)) + '</strong></div>';
    document.getElementById('fundAmount').value = '';
    document.getElementById('fundAlert').classList.remove('show');
    document.getElementById('fundModal').classList.add('show');
}

function closeFundModal() {
    document.getElementById('fundModal').classList.remove('show');
    selectedProjectId = null;
}

document.getElementById('fundModal').addEventListener('click', function(e) {
    if (e.target === e.currentTarget) closeFundModal();
});

async function confirmFund() {
    const amount = document.getElementById('fundAmount').value;
    if (!amount || parseFloat(amount) <= 0) {
        showAlert('fundAlert', 'Please enter a valid contribution amount.', 'error');
        return;
    }
    const btn = document.getElementById('confirmFundBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
        const res = await fetch('/api/user/fund', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: selectedProjectId, amount: amount })
        });
        const data = await res.json();
        if (data.success) {
            showAlert('fundAlert', data.message, 'success');
            setTimeout(function() {
                closeFundModal();
                loadOverviewStats();
                loadFeaturedProjects();
            }, 1500);
        } else {
            showAlert('fundAlert', data.message, 'error');
        }
    } catch (e) {
        showAlert('fundAlert', 'Server error.', 'error');
    }
    btn.disabled = false;
    btn.innerHTML = 'Confirm Contribution';
}

function showAlert(id, message, type) {
    type = type || 'error';
    const el = document.getElementById(id);
    el.className = 'alert alert-' + type + ' show';
    el.innerHTML = (type === 'error' ? '⚠️ ' : '✅ ') + message;
    setTimeout(function() { el.classList.remove('show'); }, 5000);
}

function formatCurrency(val) {
    return parseFloat(val || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 });
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
