const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const triggerParser = require('../services/trigger-parser');

const router = express.Router();

// Set by server/index.js: shared singletons for agent routing.
let messageQueue = null;
let agentRegistry = null;

/**
 * GET /api/messages/room/:roomId
 * Get messages for a room
 */
router.get('/room/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const messages = db.statements.getMessagesByRoom.all(roomId, limit, offset);

    res.json({
      success: true,
      data: messages.map(msg => ({
        ...msg,
        mentions: db.parseJSON(msg.mentions_json),
        metadata: db.parseJSON(msg.metadata_json)
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/messages/thread/:threadId
 * Get messages for a thread
 */
router.get('/thread/:threadId', (req, res) => {
  try {
    const messages = db.statements.getMessagesByThread.all(req.params.threadId);

    res.json({
      success: true,
      data: messages.map(msg => ({
        ...msg,
        mentions: db.parseJSON(msg.mentions_json),
        metadata: db.parseJSON(msg.metadata_json)
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/messages
 * Create a new message
 */
router.post('/', async (req, res) => {
  try {
    const { room_id, agent_id, content, parent_id, thread_id, metadata = {} } = req.body;

    if (!room_id || !content) {
      return res.status(400).json({
        success: false,
        error: 'Room ID and content are required'
      });
    }

    const id = uuidv4();
    const mentions = triggerParser.extractMentions(content);
    const mentionsJson = JSON.stringify(mentions);
    const metadataJson = JSON.stringify(metadata);
    const actualThreadId = thread_id || id;

    db.statements.createMessage.run(
      id,
      room_id,
      agent_id || null,
      content,
      mentionsJson,
      parent_id || null,
      actualThreadId,
      'sent',
      metadataJson
    );

    const message = db.statements.getMessage.get(id);

    res.status(201).json({
      success: true,
      data: {
        ...message,
        mentions,
        metadata: db.parseJSON(metadataJson)
      }
    });

    // REST-created messages route to agents the same way socket ones do.
    const formattedRestMessage = {
      ...message,
      mentions,
      metadata: db.parseJSON(metadataJson)
    };
    const parseResult = triggerParser.parseMessage(content, room_id);
    if (parseResult.targets.length > 0) {
      await messageQueue.queueForAgents(formattedRestMessage, parseResult.targets);
    } else if (triggerParser.shouldTriggerAutoResponse(content)) {
      const roomAgents = agentRegistry.getAgentsByRoom(room_id);
      const eligibleAgents = roomAgents.filter(a => a.canRespond());
      if (eligibleAgents.length > 0) {
        await messageQueue.queueForAgents(formattedRestMessage, eligibleAgents);
      }
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/messages/:id
 * Get a specific message
 */
router.get('/:id', (req, res) => {
  try {
    const message = db.statements.getMessage.get(req.params.id);

    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    res.json({
      success: true,
      data: {
        ...message,
        mentions: db.parseJSON(message.mentions_json),
        metadata: db.parseJSON(message.metadata_json)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/messages/:id/status
 * Update message status
 */
router.put('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    db.statements.updateMessageStatus.run(status, req.params.id);

    const message = db.statements.getMessage.get(req.params.id);

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set by server/index.js: shared singletons for agent routing. The deps setter
// runs at mount time, before any request hits these routes.
module.exports.setDeps = (deps) => {
  if (deps) { messageQueue = deps.messageQueue; agentRegistry = deps.agentRegistry; }
};
module.exports.router = router;
