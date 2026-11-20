const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const agentRegistry = require('../agents/registry');

const router = express.Router();

/**
 * GET /api/agents
 * Get all active agents
 */
router.get('/', (req, res) => {
  try {
    const agents = agentRegistry.getAllAgents();
    res.json({
      success: true,
      data: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        canRespond: agent.canRespond(),
        config: {
          ...agent.config,
          apiKey: undefined // Never expose API key in responses
        }
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agents/health
 * Get health status of all agents
 */
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await agentRegistry.getHealthStatus();
    res.json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agents/room/:roomId
 * Get agents for a specific room
 */
router.get('/room/:roomId', (req, res) => {
  try {
    const agents = agentRegistry.getAgentsByRoom(req.params.roomId);
    res.json({
      success: true,
      data: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        type: agent.type,
        canRespond: agent.canRespond(),
        config: agent.config
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agents
 * Register a new agent
 */
router.post('/', async (req, res) => {
  try {
    const { name, type, api_endpoint, config = {}, room_id } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        success: false,
        error: 'Name and type are required'
      });
    }

    const id = uuidv4();
    const agent = await agentRegistry.registerAgent({
      id,
      name,
      type,
      api_endpoint,
      config_json: config,
      room_id
    });

    res.status(201).json({
      success: true,
      data: {
        id: agent.id,
        name: agent.name,
        type: agent.type,
        config: {
          ...agent.config,
          apiKey: agent.config?.apiKey || undefined
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/agents/:id
 * Update an agent
 */
router.put('/:id', (req, res) => {
  try {
    const { name, type, api_endpoint, config = {}, room_id, active } = req.body;
    const configJson = JSON.stringify(config);
    if (name === undefined || type === undefined) {
      return res.status(400).json({ success: false, error: 'name and type are required for PUT; send the full agent object' });
    }

    db.statements.updateAgent.run(
      name,
      type,
      api_endpoint,
      configJson,
      room_id,
      active === undefined ? 1 : (active ? 1 : 0),
      req.params.id
    );

    const agent = db.statements.getAgent.get(req.params.id);

    res.json({
      success: true,
      data: agent
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/agents/:id
 * Unregister an agent
 */
router.delete('/:id', (req, res) => {
  try {
    agentRegistry.unregisterAgent(req.params.id);
    res.json({ success: true, message: 'Agent unregistered' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/agents/:id/toggle
 * Toggle agent active status
 */
router.post('/:id/toggle', (req, res) => {
  try {
    const { active } = req.body;
    agentRegistry.toggleAgent(req.params.id, active);
    // Reload all agents to pick up changes
    agentRegistry.reloadAll();
    res.json({ success: true, message: `Agent ${active ? 'activated' : 'deactivated'}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
