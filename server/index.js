require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Database
const db = require('./db');

// Routes
const roomsRouter = require('./routes/rooms');
const agentsRouter = require('./routes/agents');
const messagesRouter = require('./routes/messages');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json());

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Services
const triggerParser = require('./services/trigger-parser');
const MessageQueue = require('./services/message-queue');
const messageQueue = new MessageQueue(io);

// Initialize agent registry
const agentRegistry = require('./agents/registry');

// REST routes
app.use('/api/rooms', roomsRouter);
app.use('/api/agents', agentsRouter);
messagesRouter.setDeps({ messageQueue, agentRegistry });
app.use('/api/messages', messagesRouter.router);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    agents: agentRegistry.getAllAgents().length,
    rooms: db.statements.getAllRooms.all().length
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Join a room
  socket.on('room:join', (roomId) => {
    socket.join(roomId);
    console.log(`[Socket.IO] Client ${socket.id} joined room ${roomId}`);

    // Send room's recent messages
    const messages = db.statements.getRecentMessages.all(roomId, 50);
    socket.emit('room:history', messages.map(msg => ({
      ...msg,
      mentions: db.parseJSON(msg.mentions_json),
      metadata: db.parseJSON(msg.metadata_json)
    })));

    // Send room's agents
    const agents = agentRegistry.getAgentsByRoom(roomId);
    socket.emit('room:agents', agents.map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      canRespond: a.canRespond()
    })));
  });

  // Handle new message
  socket.on('message:send', async (data) => {
    const { room_id, content, agent_id, parent_id } = data;

    if (!room_id || !content || content.trim() === '') {
      socket.emit('message:error', { error: 'Room ID and content are required' });
      return;
    }

    const id = uuidv4();
    const mentions = triggerParser.extractMentions(content);
    const threadId = parent_id || id;

    // Store message
    const metadata = JSON.stringify({
      socketId: socket.id,
      clientTimestamp: data.clientTimestamp || null
    });

    db.statements.createMessage.run(
      id,
      room_id,
      agent_id || null,
      content,
      JSON.stringify(mentions),
      parent_id || null,
      threadId,
      'sent',
      metadata
    );

    const message = db.statements.getMessage.get(id);
    const formattedMessage = {
      ...message,
      mentions,
      metadata: db.parseJSON(metadata)
    };

    // Broadcast to room
    io.to(room_id).emit('message:new', formattedMessage);

    // Check for @mentions and route to agents
    const parseResult = triggerParser.parseMessage(content, room_id);

    if (parseResult.targets.length > 0) {
      console.log(`[Server] Routing message to ${parseResult.targets.length} agents:`,
        parseResult.targets.map(a => a.name).join(', '));

      await messageQueue.queueForAgents(formattedMessage, parseResult.targets);
    } else if (triggerParser.shouldTriggerAutoResponse(content)) {
      // Auto-trigger: agents respond to questions even without @mention
      const roomAgents = agentRegistry.getAgentsByRoom(room_id);
      const eligibleAgents = roomAgents.filter(a => a.canRespond());

      if (eligibleAgents.length > 0) {
        console.log(`[Server] Auto-triggering ${eligibleAgents.length} agents for question`);
        await messageQueue.queueForAgents(formattedMessage, eligibleAgents);
      }
    }
  });

  // Handle typing indicator
  socket.on('message:typing', (data) => {
    socket.to(data.room_id).emit('message:typing', {
      userId: data.userId,
      username: data.username
    });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server] Error:', err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3001;

async function start() {
  try {
    // Initialize database (async wasm load)
    await db.init();

    // Initialize agent registry
    agentRegistry.initialize();

    server.listen(PORT, () => {
      console.log(`[War Room] Server running on port ${PORT}`);
      console.log(`[War Room] Health check: http://localhost:${PORT}/api/health`);
      console.log(`[War Room] WebSocket ready for connections`);
    });
  } catch (error) {
    console.error('[War Room] Failed to start:', error.message);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[War Room] SIGTERM received, shutting down gracefully');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[War Room] SIGINT received, shutting down gracefully');
  server.close(() => {
    db.close();
    process.exit(0);
  });
});

module.exports = app;
