# MCP Todo Hub

A shared task manager for AI agents and humans. Manage tasks through the web UI, a native desktop app, or the MCP protocol.

![MCP Enabled](https://img.shields.io/badge/MCP-Enabled-black)

## Features

- **Web UI** — Clean, responsive interface with dark mode
- **Desktop App** — Native Electron launcher for Windows
- **MCP Server** — AI agents can manage tasks via the Model Context Protocol
- **Real-time sync** — All clients share the same backend, changes appear everywhere instantly

---

## Quick Start (Server)

The server runs on your Linux machine and powers both the web UI and the desktop app.

```bash
git clone https://github.com/chthonik/mcp-todo-hub.git
cd mcp-todo-hub
npm install
npm run dev
```

The server starts at **http://localhost:3456**. Open it in any browser.

---

## Windows Desktop App

Install and run the Electron desktop launcher on your Windows machine.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Git](https://git-scm.com/)

### Installation

```powershell
git clone https://github.com/chthonik/mcp-todo-hub.git
cd mcp-todo-hub\desktop
npm install
```

### Launch

```powershell
npm start
```

The app connects to the backend server. If the server is unreachable, a splash screen appears with a **Retry** button.

### Changing the Server Address

By default the app connects to `http://144.144.1.127:3456`. To point it at a different server, create this file:

```
%APPDATA%\mcp-todo-hub-desktop\server-config.json
```

```json
{ "serverUrl": "http://YOUR_SERVER_IP:3456" }
```

---

## MCP Server

Connect AI agents to manage tasks via the Model Context Protocol:

```bash
npm run mcp
```

See [DEPLOY.md](DEPLOY.md) for full deployment and MCP configuration details.

---

## Project Structure

```
mcp-todo-hub/
├── server.js          # Express API server
├── db.js              # SQLite database layer
├── mcp-server.js      # MCP protocol server
├── public/            # Web UI (HTML/CSS/JS)
│   ├── index.html
│   ├── style.css
│   └── app.js
└── desktop/           # Electron desktop app
    ├── main.js        # Main process
    ├── preload.js     # IPC bridge
    ├── splash.html    # Offline/loading page
    └── icon.png       # App icon
```
