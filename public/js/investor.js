// ============================================
// VentureFlow — Investor Dashboard
// ============================================

let currentUser = null;
let categories = [];
let selectedProjectId = null;

(async () => {
    await checkAuth();
    await loadStats();
    await loadCategories();
    await loadOverviewInvestments();
    await loadDiscoverProjects();
})();

async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.success || data.user.role_id !== 3) {
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
    document.getElementById(`sec-${section}`).classList.add('active');
    event.currentTarget.classList.add('active');
    const titles = { overview: 'Overview', discover: 'Discover Projects', history: 'My Investments' };
    document.getElementById('topbarTitle').textContent = titles[section] || section;
    if (section === 'history') loadHistory();
    if (section === 'discover') loadDiscoverProjects();
}

async function loadStats() {
    try {
        const res = await fetch('/api/investor/stats');
        const data = await res.json();
        if (data.success) {
            const s = data.stats;
            document.getElementById('stat-total-invested').textContent = formatCurrency(s.total_invested);
            document.getElementById('stat-projects-backed').textContent = s.projects_backed || 0;
            document.getElementById('stat-successful').textContent = s.successful_projects || 0;
            document.getElementById('stat-txns').textContent = s.total_investments || 0;
        }
    } catch (e) { console.error(e); }
}

async function loadCategories() {
    if (categories.length > 0) return;
    try {
        const res = await fetch('/api/common/categories');
        const data = await res.json();
        if (data.success) {
            categories = data.categories;
            const sel = document.getElementById('searchCategory');
            categories.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.category_id;
                opt.textContent = c.category_name;
                sel.appendChild(opt);
            });
        }
    } catch (e) { console.error(e); }
}

async function loadOverviewInvestments() {
    const container = document.getElementById('overviewInvestments');
    try {
        const res = await fetch('/api/investor/history');
        const data = await res.json();
        if (!data.success || data.investments.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <span class="empty-icon">💼</span>
                <p>You haven't made any investments yet. Discover projects to begin!</p>
                <button class="btn btn-secondary btn-sm" onclick="navigate('discover')">Discover Projects</button>
            </div>`;
            return;
        }
        const recent = data.investments.slice(0, 5);
        container.innerHTML = `<div class="table-wrap"><table>
            <thead><tr><th>Project</th><th>Amount (PKR)</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>${recent.map(i => `
                <tr>
                    <td class="td-main">${escHtml(i.project_title)}</td>
                    <td class="td-gold">${formatCurrency(i.amount)}</td>
                    <td><span class="status-badge ${i.project_status.toLowerCase()}">${i.project_status}</span></td>
                    <td>${formatDate(i.invested_at)}</td>
                </tr>`).join('')}
            </tbody>
        </table></div>`;
    } catch (e) {
        container.innerHTML = '<p class="text-dim">Failed to load.</p>';
    }
}

async function loadDiscoverProjects(params = {}) {
    const container = document.getElementById('discoverGrid');
    container.innerHTML = '<div class="loading-center" style="grid-column:1/-1"><div class="spinner"></div></div>';
    try {
        const query = new URLSearchParams(params).toString();
        const res = await fetch('/api/investor/search?' + query);
        const data = await res.json();
        if (!data.success || data.projects.length === 0) {
            container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
                <span class="empty-icon">🔍</span>
                <p>No active projects found. Try adjusting your search filters.</p>
            </div>`;
            return;
        }
        container.innerHTML = data.projects.map(p => renderProjectCard(p)).join('');
    } catch (e) {
        container.innerHTML = '<div class="text-dim" style="grid-column:1/-1">Failed to load projects.</div>';
    }
}

function renderProjectCard(p) {
    const pct = Math.min(100, parseFloat(p.percent_funded) || 0);
    return `
    <div class="project-card">
        <div class="project-card-top">
            <span class="project-category-tag">${escHtml(p.category_name)}</span>
            <span class="status-badge active">Active</span>
        </div>
        <div class="project-title">${escHtml(p.title)}</div>
        <div class="project-desc">${escHtml(p.description || 'No description provided.')}</div>
        <div class="project-entrepreneur">👤 By ${escHtml(p.entrepreneur_name)}</div>
        <div class="progress-section">
            <div class="progress-meta">
                <span class="progress-amount">PKR ${formatCurrency(p.total_collected)}</span>
                <span class="progress-pct">${pct}%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill ${pct>=100?'full':''}" style="width:${pct}%"></div>
            </div>
        </div>
        <div class="project-footer" style="margin-bottom:14px;">
            <span class="project-deadline">📅 ${formatDate(p.deadline)}</span>
            <span class="project-goal">Goal: <span>PKR ${formatCurrency(p.funding_goal)}</span></span>
        </div>
        <button class="btn btn-primary" style="width:100%;" onclick="openInvestModal(${p.project_id}, '${escHtml(p.title)}', ${p.funding_goal}, ${p.total_collected}, ${pct})">
            💰 Invest Now
        </button>
    </div>`;
}

function searchProjects() {
    const title = document.getElementById('searchTitle').value.trim();
    const category_id = document.getElementById('searchCategory').value;
    const params = {};
    if (title) params.title = title;
    if (category_id) params.category_id = category_id;
    loadDiscoverProjects(params);
}

function clearSearch() {
    document.getElementById('searchTitle').value = '';
    document.getElementById('searchCategory').value = '';
    loadDiscoverProjects();
}

async function loadHistory() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = '<tr><td colspan="7"><div class="loading-center"><div class="spinner"></div></div></td></tr>';
    try {
        const res = await fetch('/api/investor/history');
        const data = await res.json();
        if (!data.success || data.investments.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
                <span class="empty-icon">📜</span><p>No investment history yet.</p>
            </div></td></tr>`;
            return;
        }
        tbody.innerHTML = data.investments.map(i => {
            const pct = Math.min(100, parseFloat(i.percent_funded) || 0);
            return `<tr>
                <td class="td-main">${escHtml(i.project_title)}</td>
                <td>${escHtml(i.category_name)}</td>
                <td>${escHtml(i.entrepreneur_name)}</td>
                <td class="td-gold">${formatCurrency(i.amount)}</td>
                <td><span class="status-badge ${i.project_status.toLowerCase()}">${i.project_status}</span></td>
                <td>
                    <div style="display:flex;align-items:center;gap:8px;min-width:100px;">
                        <div class="progress-bar" style="flex:1;height:5px;">
                            <div class="progress-fill ${pct>=100?'full':''}" style="width:${pct}%"></div>
                        </div>
                        <span style="font-size:0.78rem;color:var(--gold);font-weight:600;">${pct}%</span>
                    </div>
                </td>
                <td>${formatDate(i.invested_at)}</td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-dim">Failed to load.</td></tr>';
    }
}

// ——— Invest Modal ———
function openInvestModal(projectId, title, goal, collected, pct) {
    selectedProjectId = projectId;
    document.getElementById('investProjectInfo').innerHTML = `
        <div class="project-title" style="margin-bottom:8px;">${escHtml(title)}</div>
        <div style="margin-bottom:10px;">
            <div class="progress-meta">
                <span style="font-size:0.85rem;color:var(--text-2);">PKR ${formatCurrency(collected)} raised of PKR ${formatCurrency(goal)}</span>
                <span class="progress-pct">${pct}%</span>
            </div>
            <div class="progress-bar" style="margin-top:6px;">
                <div class="progress-fill" style="width:${pct}%"></div>
            </div>
        </div>
        <div style="font-size:0.82rem;color:var(--text-3);">Remaining: <strong style="color:var(--text);">PKR ${formatCurrency(parseFloat(goal) - parseFloat(collected))}</strong></div>
    `;
    document.getElementById('investAmount').value = '';
    document.getElementById('investAlert').classList.remove('show');
    document.getElementById('investModal').classList.add('show');
}

function closeInvestModal() {
    document.getElementById('investModal').classList.remove('show');
    selectedProjectId = null;
}

document.getElementById('investModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeInvestModal();
});

async function confirmInvest() {
    const amount = document.getElementById('investAmount').value;
    if (!amount || parseFloat(amount) <= 0) {
        showAlert('investAlert', 'Please enter a valid investment amount.', 'error');
        return;
    }
    const btn = document.getElementById('confirmInvestBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
        const res = await fetch('/api/investor/invest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: selectedProjectId, amount })
        });
        const data = await res.json();
        if (data.success) {
            showAlert('investAlert', data.message, 'success');
            setTimeout(() => {
                closeInvestModal();
                loadStats();
                loadDiscoverProjects();
                loadOverviewInvestments();
            }, 1500);
        } else {
            showAlert('investAlert', data.message, 'error');
        }
    } catch (e) {
        showAlert('investAlert', 'Server error.', 'error');
    }
    btn.disabled = false;
    btn.innerHTML = 'Confirm Investment';
}

// ——— Utilities ———
function showAlert(id, message, type = 'error') {
    const el = document.getElementById(id);
    el.className = `alert alert-${type} show`;
    el.innerHTML = (type === 'error' ? '⚠️ ' : '✅ ') + message;
    setTimeout(() => el.classList.remove('show'), 5000);
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
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
