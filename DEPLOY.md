# MCP Todo Hub — Deployment Guide

## What This Is

A shared todo list app with **two interfaces**:
1. **Web UI** — A browser-based dashboard (runs on port 3456) for humans to add/edit/view tasks
2. **MCP Server** — An MCP (Model Context Protocol) server so AI agents (Claude, Cursor, etc.) can read/write the same tasks

Both share the same **SQLite database** (`todos.db`), so changes from either side are instantly visible to the other.

---

## Project Structure

```
mcp-todo-hub/
├── package.json        # Dependencies & scripts
├── db.js               # Shared SQLite database layer (CRUD, categories, activity log, stats)
├── server.js           # Express web server (REST API + serves static files, port 3456)
├── mcp-server.js       # MCP server (stdio transport, 9 tools + 1 resource)
├── public/
│   ├── index.html      # Web UI HTML
│   ├── style.css       # Dark-mode premium design
│   └── app.js          # Client-side JavaScript (API calls, rendering, auto-refresh)
├── todos.db            # SQLite database (auto-created on first run)
└── DEPLOY.md           # This file
```

---

## Deploy to Ubuntu Server (144.144.1.127)

### Step 1: Install Node.js (if not already installed)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # should be v20+
```

### Step 2: Copy project files to the server

From the Windows machine, run:
```powershell
scp -r "C:\Users\max\Desktop\AI Projects\mcp-todo-hub" max@144.144.1.127:~/mcp-todo-hub
```

Or if files are already on the server, skip this step.

### Step 3: Install dependencies

```bash
cd ~/mcp-todo-hub
npm install
```

### Step 4: Test that it works

```bash
node server.js
```

You should see: `🚀 MCP Todo Hub running at http://localhost:3456`

Visit `http://144.144.1.127:3456` from any browser on the network to confirm.

### Step 5: Run as a persistent service with PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the web server
pm2 start server.js --name "todo-hub"

# Make it survive reboots
pm2 startup
pm2 save
```

Now the web UI will always be running at `http://144.144.1.127:3456`.

### Step 6: Open the firewall (if needed)

```bash
sudo ufw allow 3456/tcp
```

---

## MCP Server Configuration

The MCP server runs via **stdio** (not HTTP). Each AI agent runs its own MCP server process, but they all connect to the **same SQLite database** on the Ubuntu server.

### For local AI agents (on the Ubuntu server)

Add to your MCP client config (e.g., `~/.config/claude_desktop_config.json` or `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "todo-hub": {
      "command": "node",
      "args": ["/home/max/mcp-todo-hub/mcp-server.js"],
      "env": {
        "DB_PATH": "/home/max/mcp-todo-hub/todos.db"
      }
    }
  }
}
```

### For remote AI agents (on other machines)

Remote agents can use the **REST API** directly:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/todos` | GET | List todos (supports `?status=`, `?priority=`, `?search=`, `?assignee=`, `?category_id=` query params) |
| `/api/todos/:id` | GET | Get single todo |
| `/api/todos` | POST | Create todo (`{ title, description, priority, category_id, assignee, due_date }`) |
| `/api/todos/:id` | PATCH | Update todo (any field) |
| `/api/todos/:id` | DELETE | Delete todo |
| `/api/categories` | GET | List categories |
| `/api/categories` | POST | Create category (`{ name, color }`) |
| `/api/stats` | GET | Dashboard stats |
| `/api/activity` | GET | Activity log (`?limit=N`) |

Example:
```bash
# Add a task from any machine
curl -X POST http://144.144.1.127:3456/api/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Review contract", "priority": "high", "assignee": "Max"}'

# List all pending tasks
curl http://144.144.1.127:3456/api/todos?status=pending
```

---

## MCP Server Tools (9 tools available)

| Tool | Description |
|------|-------------|
| `list_todos` | List all todos with optional status/priority/assignee/search filters |
| `get_todo` | Get full details of a specific todo by ID |
| `add_todo` | Create a new todo with title, description, priority, assignee, due date, category |
| `update_todo` | Update any field on an existing todo |
| `complete_todo` | Mark a todo as done |
| `delete_todo` | Permanently delete a todo |
| `list_categories` | List all categories |
| `add_category` | Create a new category |
| `get_dashboard` | Get summary stats + recent activity |

---

## Features

- **Dark premium UI** with animations and responsive design
- **Categories** with color coding (General, Work, Personal, Urgent + custom)
- **Priority levels**: Low, Medium, High, Urgent
- **Status tracking**: Pending → In Progress → Done
- **Assignees** for team task delegation
- **Due dates** with overdue detection
- **Activity log** tracking who did what (web vs mcp-agent)
- **Search** across titles and descriptions
- **Auto-refresh** every 10 seconds (so MCP agent changes appear in the web UI)
- **SQLite with WAL mode** for safe concurrent access

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3456` | Web server port |
| `DB_PATH` | `./todos.db` | Path to SQLite database file |
