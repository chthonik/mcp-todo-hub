import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
    getAllTodos, getTodoById, createTodo, updateTodo, deleteTodo,
    getAllCategories, createCategory,
    getActivityLog, getStats
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3456;

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// ─── REST API ───

// Todos
app.get('/api/todos', (req, res) => {
    try {
        const filters = {
            status: req.query.status || null,
            priority: req.query.priority || null,
            category_id: req.query.category_id || null,
            assignee: req.query.assignee || null,
            search: req.query.search || null,
        };
        res.json(getAllTodos(filters));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/todos/:id', (req, res) => {
    try {
        const todo = getTodoById(parseInt(req.params.id));
        if (!todo) return res.status(404).json({ error: 'Todo not found' });
        res.json(todo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/todos', (req, res) => {
    try {
        if (!req.body.title) return res.status(400).json({ error: 'Title is required' });
        const todo = createTodo(req.body, 'web');
        res.status(201).json(todo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/todos/:id', (req, res) => {
    try {
        const todo = updateTodo(parseInt(req.params.id), req.body, 'web');
        if (!todo) return res.status(404).json({ error: 'Todo not found' });
        res.json(todo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/todos/:id', (req, res) => {
    try {
        const ok = deleteTodo(parseInt(req.params.id), 'web');
        if (!ok) return res.status(404).json({ error: 'Todo not found' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Categories
app.get('/api/categories', (req, res) => {
    try {
        res.json(getAllCategories());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/categories', (req, res) => {
    try {
        if (!req.body.name) return res.status(400).json({ error: 'Name is required' });
        const cat = createCategory(req.body.name, req.body.color);
        res.status(201).json(cat);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Activity & Stats
app.get('/api/activity', (req, res) => {
    try {
        res.json(getActivityLog(parseInt(req.query.limit) || 50));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/stats', (req, res) => {
    try {
        res.json(getStats());
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`\n  🚀 MCP Todo Hub running at http://localhost:${PORT}\n`);
});
