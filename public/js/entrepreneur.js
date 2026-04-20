// ============================================
// VentureFlow — Entrepreneur Dashboard
// ============================================

let currentUser = null;
let categories = [];

// ——— Init ———
(async () => {
    await checkAuth();
    await loadStats();
    await loadCategories();
    await loadOverviewProjects();
    // Set min date for deadline
    document.getElementById('pDeadline').min = new Date().toISOString().split('T')[0];
})();

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.success || data.user.role_id !== 2) {
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

// ——— Navigation ———
function navigate(section) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`sec-${section}`).classList.add('active');
    event.currentTarget.classList.add('active');

    const titles = {
        overview: 'Overview',
        create: 'Create Project',
        myprojects: 'My Projects',
        funding: 'Funding Tracker'
    };
    document.getElementById('topbarTitle').textContent = titles[section] || section;

    if (section === 'myprojects') loadMyProjects();
    if (section === 'funding') loadFundingTracker();
    if (section === 'create') loadCategories();
}

// ——— Stats ———
async function loadStats() {
    try {
        const res = await fetch('/api/entrepreneur/stats');
        const data = await res.json();
        if (data.success) {
            const s = data.stats;
            document.getElementById('stat-total').textContent = s.total_projects || 0;
            document.getElementById('stat-active').textContent = s.active_projects || 0;
            document.getElementById('stat-funded').textContent = s.funded_projects || 0;
            document.getElementById('stat-raised').textContent = formatCurrency(s.total_raised || 0);
        }
    } catch (e) { console.error(e); }
}

// ——— Categories ———
async function loadCategories() {
    if (categories.length > 0) return;
    try {
        const res = await fetch('/api/common/categories');
        const data = await res.json();
        if (data.success) {
            categories = data.categories;
            const sel = document.getElementById('pCategory');
            sel.innerHTML = '<option value="">— Select Category —</option>';
            categories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.category_id;
                opt.textContent = c.category_name;
                sel.appendChild(opt);
            });
        }
    } catch (e) { console.error(e); }
}

// ——— Create Project ———
async function createProject() {
    const title = document.getElementById('pTitle').value.trim();
    const description = document.getElementById('pDesc').value.trim();
    const category_id = document.getElementById('pCategory').value;
    const funding_goal = document.getElementById('pGoal').value;
    const deadline = document.getElementById('pDeadline').value;

    if (!title || !category_id || !funding_goal || !deadline) {
        showAlert('createAlert', 'Please fill all required fields.', 'error');
        return;
    }

    setLoading('createBtn', true);
    try {
        const res = await fetch('/api/entrepreneur/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, funding_goal, deadline, category_id })
        });
        const data = await res.json();
        if (data.success) {
            showAlert('createAlert', data.message, 'success');
            document.getElementById('pTitle').value = '';
            document.getElementById('pDesc').value = '';
            document.getElementById('pGoal').value = '';
            document.getElementById('pDeadline').value = '';
            document.getElementById('pCategory').value = '';
            loadStats();
        } else {
            showAlert('createAlert', data.message, 'error');
        }
    } catch (e) {
        showAlert('createAlert', 'Server error.', 'error');
    }
    setLoading('createBtn', false, 'Submit Project');
}

// ——— Overview Projects ———
async function loadOverviewProjects() {
    try {
        const res = await fetch('/api/entrepreneur/projects');
        const data = await res.json();
        const container = document.getElementById('overviewProjectsList');
        if (!data.success || data.projects.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <span class="empty-icon">📭</span>
                <p>No projects yet. Create your first project to get started!</p>
                <button class="btn btn-secondary btn-sm" onclick="navigate('create')">Create Project</button>
            </div>`;
            return;
        }
        const recent = data.projects.slice(0, 3);
        container.innerHTML = `
            <div class="projects-grid">
                ${recent.map(p => renderProjectCard(p)).join('')}
            </div>`;
    } catch (e) { console.error(e); }
}

// ——— My Projects ———
async function loadMyProjects() {
    const container = document.getElementById('myProjectsGrid');
    container.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
    try {
        const res = await fetch('/api/entrepreneur/projects');
        const data = await res.json();
        if (!data.success || data.projects.length === 0) {
            container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
                <span class="empty-icon">📁</span>
                <p>No projects found. Start by creating your first project.</p>
                <button class="btn btn-primary btn-sm" onclick="navigate('create')">+ New Project</button>
            </div>`;
            return;
        }
        container.innerHTML = data.projects.map(p => renderProjectCard(p, true)).join('');
    } catch (e) {
        container.innerHTML = '<p class="text-dim">Failed to load projects.</p>';
    }
}

function renderProjectCard(p, showInvestments = false) {
    const pct = Math.min(100, parseFloat(p.percent_funded) || 0);
    const statusClass = p.status.toLowerCase();
    return `
    <div class="project-card">
        <div class="project-card-top">
            <span class="project-category-tag">${p.category_name}</span>
            <span class="status-badge ${statusClass}">${p.status}</span>
        </div>
        <div class="project-title">${escHtml(p.title)}</div>
        <div class="project-desc">${escHtml(p.description || 'No description provided.')}</div>
        <div class="progress-section">
            <div class="progress-meta">
                <span class="progress-amount">PKR ${formatCurrency(p.total_collected)}</span>
                <span class="progress-pct">${pct}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill ${pct >= 100 ? 'full' : ''}" style="width:${pct}%"></div>
            </div>
        </div>
        <div class="project-footer">
            <span class="project-deadline">📅 ${formatDate(p.deadline)}</span>
            <span class="project-goal">Goal: <span>PKR ${formatCurrency(p.funding_goal)}</span></span>
        </div>
        ${showInvestments ? `<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px;">
            <button class="btn btn-ghost btn-sm" onclick="viewInvestments(${p.project_id}, '${escHtml(p.title)}')">
                📈 View Investments
            </button>
        </div>` : ''}
    </div>`;
}

// ——— Funding Tracker ———
async function loadFundingTracker() {
    const tbody = document.getElementById('fundingTableBody');
    tbody.innerHTML = '<tr><td colspan="8"><div class="loading-center"><div class="spinner"></div></div></td></tr>';
    try {
        const res = await fetch('/api/entrepreneur/projects');
        const data = await res.json();
        if (!data.success || data.projects.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
                <span class="empty-icon">💰</span><p>No projects to track yet.</p>
            </div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.projects.map(p => {
            const pct = Math.min(100, parseFloat(p.percent_funded) || 0);
            const statusClass = p.status.toLowerCase();
            return `<tr>
                <td class="td-main">${escHtml(p.title)}</td>
                <td>${escHtml(p.category_name)}</td>
                <td class="td-gold">${formatCurrency(p.funding_goal)}</td>
                <td class="td-gold">${formatCurrency(p.total_collected)}</td>
                <td>${formatCurrency(p.remaining_amount)}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;min-width:120px;">
                        <div class="progress-bar" style="flex:1;height:5px;">
                            <div class="progress-fill ${pct>=100?'full':''}" style="width:${pct}%"></div>
                        </div>
                        <span style="font-size:0.78rem;color:var(--gold);font-weight:600;white-space:nowrap;">${pct}%</span>
                    </div>
                </td>
                <td><span class="status-badge ${statusClass}">${p.status}</span></td>
                <td>${formatDate(p.deadline)}</td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-dim">Failed to load data.</td></tr>';
    }
}

// ——— Investment Details Modal ———
async function viewInvestments(projectId, title) {
    document.getElementById('investModal').classList.add('show');
    const body = document.getElementById('investModalBody');
    body.innerHTML = '<div class="loading-center"><div class="spinner"></div></div>';
    try {
        const res = await fetch(`/api/entrepreneur/projects/${projectId}/investments`);
        const data = await res.json();
        if (!data.success || data.investments.length === 0) {
            body.innerHTML = `<div class="empty-state" style="padding:32px 0;">
                <span class="empty-icon">📭</span>
                <p>No investments recorded for <strong>${escHtml(title)}</strong> yet.</p>
            </div>`;
            return;
        }
        body.innerHTML = `
            <h3 class="font-head fw-700 mb-16">${escHtml(title)}</h3>
            <div class="table-wrap">
                <table>
                    <thead>
                        <tr><th>Investor</th><th>Amount (PKR)</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                        ${data.investments.map(i => `
                        <tr>
                            <td class="td-main">${escHtml(i.investor_name)}</td>
                            <td class="td-gold">${formatCurrency(i.amount)}</td>
                            <td>${formatDateTime(i.invested_at)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (e) {
        body.innerHTML = '<p class="text-dim">Failed to load investment data.</p>';
    }
}

function closeModal() {
    document.getElementById('investModal').classList.remove('show');
}

document.getElementById('investModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
});

// ——— Utilities ———
function showAlert(id, message, type = 'error') {
    const el = document.getElementById(id);
    el.className = `alert alert-${type} show`;
    el.innerHTML = (type === 'error' ? '⚠️ ' : '✅ ') + message;
    setTimeout(() => el.classList.remove('show'), 5000);
}

function setLoading(btnId, loading, label = '') {
    const btn = document.getElementById(btnId);
    btn.disabled = loading;
    btn.innerHTML = loading ? '<span class="spinner"></span>' : label;
}

function formatCurrency(val) {
    return parseFloat(val || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 });
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dt) {
    if (!dt) return '—';
    const d = new Date(dt);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
