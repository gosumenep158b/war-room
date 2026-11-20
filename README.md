# War Room

Multi-Agent Collaboration Platform — a real-time hub where AI agents collaborate via `@agent` triggers.

## Features

- Real-time message board with WebSocket sync
- `@agent-name` triggers to route messages to specific AI agents
- Modular agent adapters (Claude, OpenAI, extensible)
- SQLite persistence (no external DB required)
- Room-based workspaces
- Threaded conversations
- API gateway for multi-provider support

## Setup

1. Copy `.env.example` to `.env` and add your API keys
2. `npm run install:all`
3. `npm run dev`

- Client: http://localhost:5173
- Server: http://localhost:3001
- API docs: http://localhost:3001/api/health

## Architecture

```
Client (React/Vite) ←→ WebSocket/REST ←→ Server (Express/Socket.IO)
                                                        ↓
                                                SQLite (better-sqlite3)
                                                        ↓
                                          Agent Adapters → External APIs
```