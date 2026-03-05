import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || join(__dirname, 'todos.db');

let db;

export function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('busy_timeout = 5000');
        initSchema(db);
    }
    return db;
}

function initSchema(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      assignee TEXT DEFAULT '',
      due_date TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER REFERENCES todos(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      details TEXT DEFAULT '',
      actor TEXT DEFAULT 'web',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

    // Seed default category if empty
    const count = db.prepare('SELECT COUNT(*) as cnt FROM categories').get();
    if (count.cnt === 0) {
        db.prepare("INSERT INTO categories (name, color) VALUES (?, ?)").run('General', '#6366f1');
        db.prepare("INSERT INTO categories (name, color) VALUES (?, ?)").run('Work', '#f59e0b');
        db.prepare("INSERT INTO categories (name, color) VALUES (?, ?)").run('Personal', '#10b981');
        db.prepare("INSERT INTO categories (name, color) VALUES (?, ?)").run('Urgent', '#ef4444');
    }
}

// ─── Todo Operations ───

export function getAllTodos(filters = {}) {
    const db = getDb();
    let query = `
    SELECT t.*, c.name as category_name, c.color as category_color
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE 1=1
  `;
    const params = [];

    if (filters.status) {
        query += ' AND t.status = ?';
        params.push(filters.status);
    }
    if (filters.priority) {
        query += ' AND t.priority = ?';
        params.push(filters.priority);
    }
    if (filters.category_id) {
        query += ' AND t.category_id = ?';
        params.push(filters.category_id);
    }
    if (filters.assignee) {
        query += ' AND t.assignee LIKE ?';
        params.push(`%${filters.assignee}%`);
    }
    if (filters.search) {
        query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
        params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ' ORDER BY CASE t.priority WHEN \'urgent\' THEN 0 WHEN \'high\' THEN 1 WHEN \'medium\' THEN 2 WHEN \'low\' THEN 3 END, t.created_at DESC';

    return db.prepare(query).all(...params);
}

export function getTodoById(id) {
    const db = getDb();
    return db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?
  `).get(id);
}

export function createTodo({ title, description = '', priority = 'medium', category_id = null, assignee = '', due_date = null }, actor = 'web') {
    const db = getDb();
    const result = db.prepare(`
    INSERT INTO todos (title, description, priority, category_id, assignee, due_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, description, priority, category_id, assignee, due_date);

    logActivity(result.lastInsertRowid, 'created', `Task "${title}" created`, actor);
    return getTodoById(result.lastInsertRowid);
}

export function updateTodo(id, updates, actor = 'web') {
    const db = getDb();
    const existing = getTodoById(id);
    if (!existing) return null;

    const fields = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
        if (['title', 'description', 'status', 'priority', 'category_id', 'assignee', 'due_date'].includes(key)) {
            fields.push(`${key} = ?`);
            params.push(value);
        }
    }

    if (updates.status === 'done' && existing.status !== 'done') {
        fields.push('completed_at = CURRENT_TIMESTAMP');
    } else if (updates.status && updates.status !== 'done') {
        fields.push('completed_at = NULL');
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    const changes = Object.entries(updates).map(([k, v]) => `${k}: ${existing[k]} → ${v}`).join(', ');
    logActivity(id, 'updated', changes, actor);

    return getTodoById(id);
}

export function deleteTodo(id, actor = 'web') {
    const db = getDb();
    const existing = getTodoById(id);
    if (!existing) return false;
    logActivity(id, 'deleted', `Task "${existing.title}" deleted`, actor);
    db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    return true;
}

// ─── Category Operations ───

export function getAllCategories() {
    const db = getDb();
    return db.prepare('SELECT * FROM categories ORDER BY name').all();
}

export function createCategory(name, color = '#6366f1') {
    const db = getDb();
    const result = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').run(name, color);
    return { id: result.lastInsertRowid, name, color };
}

// ─── Activity Log ───

function logActivity(todoId, action, details, actor = 'web') {
    const db = getDb();
    db.prepare('INSERT INTO activity_log (todo_id, action, details, actor) VALUES (?, ?, ?, ?)').run(todoId, action, details, actor);
}

export function getActivityLog(limit = 50) {
    const db = getDb();
    return db.prepare(`
    SELECT al.*, t.title as todo_title
    FROM activity_log al
    LEFT JOIN todos t ON al.todo_id = t.id
    ORDER BY al.created_at DESC
    LIMIT ?
  `).all(limit);
}

// ─── Stats ───

export function getStats() {
    const db = getDb();
    const total = db.prepare('SELECT COUNT(*) as cnt FROM todos').get().cnt;
    const pending = db.prepare("SELECT COUNT(*) as cnt FROM todos WHERE status = 'pending'").get().cnt;
    const inProgress = db.prepare("SELECT COUNT(*) as cnt FROM todos WHERE status = 'in_progress'").get().cnt;
    const done = db.prepare("SELECT COUNT(*) as cnt FROM todos WHERE status = 'done'").get().cnt;
    const urgent = db.prepare("SELECT COUNT(*) as cnt FROM todos WHERE priority = 'urgent' AND status != 'done'").get().cnt;
    const overdue = db.prepare("SELECT COUNT(*) as cnt FROM todos WHERE due_date < date('now') AND status != 'done'").get().cnt;

    return { total, pending, inProgress, done, urgent, overdue };
}
