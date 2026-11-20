const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'warroom.db');

let db = null;

const statements = {};

const SCHEMA = `
  -- Rooms: collaboration spaces
  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    config_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Agents: registered agent instances
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    api_endpoint TEXT,
    config_json TEXT DEFAULT '{}',
    room_id TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  -- Messages: all communication
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    agent_id TEXT,
    content TEXT NOT NULL,
    mentions_json TEXT DEFAULT '[]',
    parent_id TEXT,
    thread_id TEXT,
    status TEXT DEFAULT 'sent',
    metadata_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE SET NULL
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);
  CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
  CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);
  CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
  CREATE INDEX IF NOT EXISTS idx_agents_room ON agents(room_id);
  CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(active);

  -- Conversations metadata (optional, for tracking active threads)
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    root_message_id TEXT,
    last_activity TEXT DEFAULT (datetime('now')),
    participant_count INTEGER DEFAULT 0,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (root_message_id) REFERENCES messages(id) ON DELETE SET NULL
  );
`;

/**
 * Persist the in-memory database to disk.
 * sql.js is in-memory only, so we serialize the DB file on every write.
 */
function save() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (err) {
    console.error('[db] Failed to persist database:', err.message);
  }
}

/**
 * Create a sync statement wrapper around sql.js.
 * sql.js statements are single-use, so we prepare/bind/run/free per call.
 */
function createStatement(sql) {
  return {
    run(...params) {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(params);
        stmt.step();
      } finally {
        stmt.free();
      }
      save();
    },
    get(...params) {
      const stmt = db.prepare(sql);
      let row = undefined;
      try {
        stmt.bind(params);
        if (stmt.step()) {
          row = stmt.getAsObject();
        }
      } finally {
        stmt.free();
      }
      return row;
    },
    all(...params) {
      const stmt = db.prepare(sql);
      const rows = [];
      try {
        stmt.bind(params);
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
      } finally {
        stmt.free();
      }
      return rows;
    }
  };
}

function buildStatements() {
  // Rooms
  statements.createRoom = createStatement(`INSERT INTO rooms (id, name, config_json) VALUES (?, ?, ?)`);
  statements.getRoom = createStatement(`SELECT * FROM rooms WHERE id = ?`);
  statements.getAllRooms = createStatement(`SELECT * FROM rooms ORDER BY created_at DESC`);
  statements.updateRoom = createStatement(`UPDATE rooms SET name = ?, config_json = ?, updated_at = datetime('now') WHERE id = ?`);
  statements.deleteRoom = createStatement(`DELETE FROM rooms WHERE id = ?`);

  // Agents
  statements.createAgent = createStatement(`INSERT INTO agents (id, name, type, api_endpoint, config_json, room_id, active) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  statements.getAgent = createStatement(`SELECT * FROM agents WHERE id = ?`);
  statements.getAgentsByRoom = createStatement(`SELECT * FROM agents WHERE room_id = ? AND active = 1`);
  statements.getActiveAgents = createStatement(`SELECT * FROM agents WHERE active = 1`);
  statements.updateAgent = createStatement(`UPDATE agents SET name = ?, type = ?, api_endpoint = ?, config_json = ?, room_id = ?, active = ? WHERE id = ?`);
  statements.deleteAgent = createStatement(`DELETE FROM agents WHERE id = ?`);
  statements.toggleAgentActive = createStatement(`UPDATE agents SET active = ? WHERE id = ?`);

  // Messages
  statements.createMessage = createStatement(`INSERT INTO messages (id, room_id, agent_id, content, mentions_json, parent_id, thread_id, status, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  statements.getMessage = createStatement(`SELECT * FROM messages WHERE id = ?`);
  statements.getMessagesByRoom = createStatement(`
    SELECT m.*, a.name as agent_name, a.type as agent_type
    FROM messages m
    LEFT JOIN agents a ON m.agent_id = a.id
    WHERE m.room_id = ?
    ORDER BY m.created_at ASC
    LIMIT ? OFFSET ?
  `);
  statements.getMessagesByThread = createStatement(`
    SELECT m.*, a.name as agent_name, a.type as agent_type
    FROM messages m
    LEFT JOIN agents a ON m.agent_id = a.id
    WHERE m.thread_id = ?
    ORDER BY m.created_at ASC
  `);
  statements.getRecentMessages = createStatement(`
    SELECT m.*, a.name as agent_name, a.type as agent_type
    FROM messages m
    LEFT JOIN agents a ON m.agent_id = a.id
    WHERE m.room_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `);
  statements.updateMessageStatus = createStatement(`UPDATE messages SET status = ? WHERE id = ?`);

  // Conversations
  statements.createConversation = createStatement(`INSERT INTO conversations (id, room_id, root_message_id) VALUES (?, ?, ?)`);
  statements.updateConversationActivity = createStatement(`UPDATE conversations SET last_activity = datetime('now') WHERE id = ?`);
}

/**
 * Async init: load wasm, restore existing DB file (if any), create schema.
 * Must be awaited before any statement is used.
 */
async function init() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
  });

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log(`[db] Loaded existing database from ${dbPath}`);
  } else {
    db = new SQL.Database();
    console.log(`[db] Created new database at ${dbPath}`);
  }

  db.exec(SCHEMA);
  buildStatements();
  save();
  console.log('[db] Schema initialized');
}

function close() {
  if (db) {
    save();
    db.close();
    db = null;
  }
}

/**
 * Helper to parse JSON stored in text columns
 */
function parseJSON(str) {
  if (!str) return {};
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

module.exports = {
  init,
  close,
  get db() { return db; },
  statements,
  parseJSON,
};
