import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
    getAllTodos, getTodoById, createTodo, updateTodo, deleteTodo,
    getAllCategories, createCategory,
    getActivityLog, getStats
} from './db.js';

const server = new McpServer({
    name: 'mcp-todo-hub',
    version: '1.0.0',
    description: 'A shared todo list that AI agents and humans can access together.',
});

// ─── Tools ───

server.tool(
    'list_todos',
    'List all todos, optionally filtered by status, priority, assignee, or search query',
    {
        status: z.enum(['pending', 'in_progress', 'done']).optional().describe('Filter by status'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Filter by priority'),
        assignee: z.string().optional().describe('Filter by assignee name (partial match)'),
        search: z.string().optional().describe('Search in title and description'),
    },
    async (params) => {
        const todos = getAllTodos(params);
        const summary = todos.length === 0
            ? 'No todos found matching the filters.'
            : todos.map(t =>
                `[${t.id}] ${t.status === 'done' ? '✅' : t.status === 'in_progress' ? '🔄' : '⬜'} [${t.priority.toUpperCase()}] ${t.title}${t.assignee ? ` (→ ${t.assignee})` : ''}${t.due_date ? ` | Due: ${t.due_date}` : ''}`
            ).join('\n');
        return { content: [{ type: 'text', text: `${todos.length} todo(s) found:\n\n${summary}` }] };
    }
);

server.tool(
    'get_todo',
    'Get full details of a specific todo by its ID',
    {
        id: z.number().describe('The todo ID'),
    },
    async ({ id }) => {
        const todo = getTodoById(id);
        if (!todo) return { content: [{ type: 'text', text: `Todo #${id} not found.` }] };
        return {
            content: [{
                type: 'text',
                text: JSON.stringify(todo, null, 2)
            }]
        };
    }
);

server.tool(
    'add_todo',
    'Create a new todo item',
    {
        title: z.string().describe('Title of the todo'),
        description: z.string().optional().describe('Detailed description'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Priority level (default: medium)'),
        assignee: z.string().optional().describe('Who is responsible for this task'),
        due_date: z.string().optional().describe('Due date in YYYY-MM-DD format'),
        category_id: z.number().optional().describe('Category ID to assign'),
    },
    async (params) => {
        const todo = createTodo(params, 'mcp-agent');
        return {
            content: [{
                type: 'text',
                text: `✅ Created todo #${todo.id}: "${todo.title}" [${todo.priority}]${todo.assignee ? ` assigned to ${todo.assignee}` : ''}`
            }]
        };
    }
);

server.tool(
    'update_todo',
    'Update an existing todo (change status, priority, assignee, etc.)',
    {
        id: z.number().describe('The todo ID to update'),
        title: z.string().optional().describe('New title'),
        description: z.string().optional().describe('New description'),
        status: z.enum(['pending', 'in_progress', 'done']).optional().describe('New status'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('New priority'),
        assignee: z.string().optional().describe('New assignee'),
        due_date: z.string().optional().describe('New due date (YYYY-MM-DD)'),
        category_id: z.number().optional().describe('New category ID'),
    },
    async ({ id, ...updates }) => {
        const todo = updateTodo(id, updates, 'mcp-agent');
        if (!todo) return { content: [{ type: 'text', text: `Todo #${id} not found.` }] };
        return {
            content: [{
                type: 'text',
                text: `✅ Updated todo #${id}: "${todo.title}" — status: ${todo.status}, priority: ${todo.priority}`
            }]
        };
    }
);

server.tool(
    'complete_todo',
    'Mark a todo as done',
    {
        id: z.number().describe('The todo ID to complete'),
    },
    async ({ id }) => {
        const todo = updateTodo(id, { status: 'done' }, 'mcp-agent');
        if (!todo) return { content: [{ type: 'text', text: `Todo #${id} not found.` }] };
        return { content: [{ type: 'text', text: `✅ Completed: "${todo.title}"` }] };
    }
);

server.tool(
    'delete_todo',
    'Permanently delete a todo',
    {
        id: z.number().describe('The todo ID to delete'),
    },
    async ({ id }) => {
        const ok = deleteTodo(id, 'mcp-agent');
        if (!ok) return { content: [{ type: 'text', text: `Todo #${id} not found.` }] };
        return { content: [{ type: 'text', text: `🗑️ Deleted todo #${id}` }] };
    }
);

server.tool(
    'list_categories',
    'List all available categories',
    {},
    async () => {
        const cats = getAllCategories();
        const text = cats.map(c => `[${c.id}] ${c.name} (${c.color})`).join('\n');
        return { content: [{ type: 'text', text: text || 'No categories found.' }] };
    }
);

server.tool(
    'add_category',
    'Create a new category for organizing todos',
    {
        name: z.string().describe('Category name'),
        color: z.string().optional().describe('Hex color code (default: #6366f1)'),
    },
    async ({ name, color }) => {
        const cat = createCategory(name, color || '#6366f1');
        return { content: [{ type: 'text', text: `✅ Created category "${cat.name}" (#${cat.id})` }] };
    }
);

server.tool(
    'get_dashboard',
    'Get a summary dashboard with stats and recent activity',
    {},
    async () => {
        const stats = getStats();
        const activity = getActivityLog(10);
        const activityText = activity.map(a =>
            `  ${a.created_at} | ${a.actor} | ${a.action}: ${a.details}`
        ).join('\n');

        const text = `📊 Dashboard Summary
━━━━━━━━━━━━━━━━━━━
Total Tasks:   ${stats.total}
Pending:       ${stats.pending}
In Progress:   ${stats.inProgress}
Done:          ${stats.done}
Urgent:        ${stats.urgent}
Overdue:       ${stats.overdue}

📝 Recent Activity:
${activityText || '  No activity yet.'}`;

        return { content: [{ type: 'text', text }] };
    }
);

// ─── Resources ───

server.resource(
    'todos-summary',
    'todos://summary',
    { description: 'A summary of all current todos', mimeType: 'text/plain' },
    async () => {
        const stats = getStats();
        const todos = getAllTodos();
        const text = `Todo Hub Summary (${new Date().toISOString()})
Total: ${stats.total} | Pending: ${stats.pending} | In Progress: ${stats.inProgress} | Done: ${stats.done} | Urgent: ${stats.urgent} | Overdue: ${stats.overdue}

All Tasks:
${todos.map(t => `[${t.id}] [${t.status}] [${t.priority}] ${t.title}${t.assignee ? ` (→ ${t.assignee})` : ''}`).join('\n')}`;
        return { contents: [{ uri: 'todos://summary', text, mimeType: 'text/plain' }] };
    }
);

// ─── Start ───

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('MCP Todo Hub server running on stdio');
}

main().catch(console.error);
