// ─── State ───
let todos = [];
let categories = [];
let currentView = 'all';
let searchQuery = '';
let lastTodosJSON = '';

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadCategories();
    loadTodos();
    loadStats();
    loadActivity();
    bindEvents();
});

// ─── Theme Management ───
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Update toggle icons if the button exists
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    if (sunIcon && moonIcon) {
        if (theme === 'dark') {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        } else {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        }
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// ─── API ───
async function api(path, opts = {}) {
    const res = await fetch(`/api${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    return res.json();
}

// ─── Data Loading ───
async function loadTodos() {
    const params = new URLSearchParams();
    if (currentView === 'urgent') {
        params.set('priority', 'urgent');
    } else if (currentView !== 'all') {
        params.set('status', currentView);
    }
    if (searchQuery) params.set('search', searchQuery);

    const newTodos = await api(`/todos?${params.toString()}`);
    const newJSON = JSON.stringify(newTodos);
    if (newJSON === lastTodosJSON) return;
    lastTodosJSON = newJSON;
    todos = newTodos;
    renderTodos();
}

async function loadCategories() {
    categories = await api('/categories');
    renderCategories();
    populateCategorySelects();
}

async function loadStats() {
    const stats = await api('/stats');
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-pending').textContent = stats.pending;
    document.getElementById('stat-inprogress').textContent = stats.inProgress;
    document.getElementById('stat-done').textContent = stats.done;
    document.getElementById('stat-overdue').textContent = stats.overdue;

    document.getElementById('count-all').textContent = stats.total;
    document.getElementById('count-pending').textContent = stats.pending;
    document.getElementById('count-progress').textContent = stats.inProgress;
    document.getElementById('count-done').textContent = stats.done;
    document.getElementById('count-urgent').textContent = stats.urgent;
}

async function loadActivity() {
    const activity = await api('/activity?limit=15');
    const feed = document.getElementById('activity-feed');
    feed.innerHTML = activity.length === 0
        ? '<div class="activity-item">No activity yet.</div>'
        : activity.map(a => `
      <div class="activity-item">
        <span class="actor">${a.actor}</span>
        <span class="action">${a.action}</span>:
        ${truncate(a.details, 60)}
      </div>
    `).join('');
}

function refreshAll() {
    loadTodos();
    loadStats();
    loadActivity();
}

// ─── Rendering ───
function renderTodos() {
    const list = document.getElementById('task-list');
    const empty = document.getElementById('empty-state');

    if (todos.length === 0) {
        list.innerHTML = '';
        list.appendChild(createEmptyState());
        return;
    }

    list.innerHTML = todos.map((t, i) => `
    <div class="task-item ${t.status === 'done' ? 'done' : ''}"
         data-priority="${t.priority}"
         data-id="${t.id}"
         style="animation-delay: ${i * 0.03}s"
         onclick="openEditModal(${t.id})">
      <div class="task-checkbox ${t.status === 'done' ? 'checked' : ''}"
           onclick="event.stopPropagation(); toggleTodo(${t.id}, '${t.status}')">
        ${t.status === 'done' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" width="12" height="12"><polyline points="20 6 9 17 4 12"></polyline></svg>' : ''}
      </div>
      <div class="task-content">
        <div class="task-title">${escapeHtml(t.title)}</div>
        <div class="task-meta">
          <span class="priority-badge priority-${t.priority}">${t.priority}</span>
          <span class="status-badge status-${t.status}">${formatStatus(t.status)}</span>
          ${t.category_name ? `<span class="category-badge" style="color:${t.category_color};border-color:${t.category_color}30;background:${t.category_color}10">${escapeHtml(t.category_name)}</span>` : ''}
          ${t.assignee ? `<span class="task-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> ${escapeHtml(t.assignee)}</span>` : ''}
          ${t.due_date ? `<span class="task-meta-item ${isOverdue(t) ? 'overdue' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> ${t.due_date}</span>` : ''}
        </div>
      </div>
      <div class="task-actions-inline">
        <button class="task-action-btn delete" onclick="event.stopPropagation(); deleteTodoItem(${t.id})" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function createEmptyState() {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.id = 'empty-state';
    div.innerHTML = `
    <div class="empty-icon">📝</div>
    <h3>No tasks found</h3>
    <p>${searchQuery ? 'Try a different search term.' : 'Add your first task above to get started!'}</p>
  `;
    return div;
}

function renderCategories() {
    const list = document.getElementById('category-list');
    list.innerHTML = categories.map(c => `
    <div class="category-item" onclick="filterByCategory(${c.id})">
      <span class="category-dot" style="background:${c.color}"></span>
      ${escapeHtml(c.name)}
    </div>
  `).join('');
}

function populateCategorySelects() {
    const selects = [
        document.getElementById('task-category'),
        document.getElementById('edit-category'),
    ];

    const options = `<option value="">No Category</option>` +
        categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

    selects.forEach(sel => { if (sel) sel.innerHTML = options; });
}

// ─── Events ───
function bindEvents() {
    // Add task
    document.getElementById('add-task-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('task-title').value.trim();
        if (!title) return;

        await api('/todos', {
            method: 'POST',
            body: {
                title,
                description: document.getElementById('task-description').value.trim(),
                priority: document.getElementById('task-priority').value,
                category_id: document.getElementById('task-category').value || null,
                assignee: document.getElementById('task-assignee').value.trim(),
                due_date: document.getElementById('task-due-date').value || null,
            },
        });

        e.target.reset();
        refreshAll();
    });

    // Search
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchQuery = e.target.value.trim();
            loadTodos();
        }, 300);
    });

    // Sidebar nav
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentView = btn.dataset.view;
            document.getElementById('view-title').textContent = btn.querySelector('.nav-label').textContent;
            loadTodos();
        });
    });

    // Mobile menu
    document.getElementById('menu-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });

    // Theme toggle
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', toggleTheme);
    }

    // Modal close
    document.getElementById('modal-close').addEventListener('click', closeEditModal);
    document.getElementById('edit-modal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeEditModal();
    });

    // Edit form
    document.getElementById('edit-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        await api(`/todos/${id}`, {
            method: 'PATCH',
            body: {
                title: document.getElementById('edit-title').value,
                description: document.getElementById('edit-description').value,
                status: document.getElementById('edit-status').value,
                priority: document.getElementById('edit-priority').value,
                category_id: document.getElementById('edit-category').value || null,
                assignee: document.getElementById('edit-assignee').value,
                due_date: document.getElementById('edit-due-date').value || null,
            },
        });
        closeEditModal();
        refreshAll();
    });

    // Delete from modal
    document.getElementById('edit-delete-btn').addEventListener('click', async () => {
        const id = document.getElementById('edit-id').value;
        if (confirm('Delete this task?')) {
            await api(`/todos/${id}`, { method: 'DELETE' });
            closeEditModal();
            refreshAll();
        }
    });

    // Add category
    document.getElementById('add-category-btn').addEventListener('click', async () => {
        const name = prompt('Category name:');
        if (!name) return;
        const color = prompt('Color (hex, e.g. #6366f1):', '#6366f1');
        await api('/categories', { method: 'POST', body: { name, color: color || '#6366f1' } });
        loadCategories();
    });

    // Auto-refresh every 10 seconds (so changes from MCP agents show up)
    setInterval(refreshAll, 10000);
}

// ─── Actions ───
async function toggleTodo(id, currentStatus) {
    const newStatus = currentStatus === 'done' ? 'pending' : 'done';
    await api(`/todos/${id}`, { method: 'PATCH', body: { status: newStatus } });
    refreshAll();
}

async function deleteTodoItem(id) {
    if (!confirm('Delete this task?')) return;
    await api(`/todos/${id}`, { method: 'DELETE' });
    refreshAll();
}

function filterByCategory(categoryId) {
    // Reset nav
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-all').classList.add('active');
    currentView = 'all';

    // Simple approach: load all and filter client-side
    api(`/todos?category_id=${categoryId}`).then(data => {
        todos = data;
        const cat = categories.find(c => c.id === categoryId);
        document.getElementById('view-title').textContent = cat ? cat.name : 'All Tasks';
        renderTodos();
    });
}

// ─── Edit Modal ───
function openEditModal(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    document.getElementById('edit-id').value = todo.id;
    document.getElementById('edit-title').value = todo.title;
    document.getElementById('edit-description').value = todo.description || '';
    document.getElementById('edit-status').value = todo.status;
    document.getElementById('edit-priority').value = todo.priority;
    document.getElementById('edit-category').value = todo.category_id || '';
    document.getElementById('edit-assignee').value = todo.assignee || '';
    document.getElementById('edit-due-date').value = todo.due_date || '';

    document.getElementById('edit-modal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('active');
}

// ─── Helpers ───
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
}

function formatStatus(s) {
    return s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
}

function isOverdue(todo) {
    if (!todo.due_date || todo.status === 'done') return false;
    return new Date(todo.due_date) < new Date();
}
