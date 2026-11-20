const db = require('../db');
const ClaudeAgent = require('./claude');
const OpenAIAgent = require('./openai');

/**
 * Agent Registry
 * Manages agent instances, discovery, and lifecycle
 */
class AgentRegistry {
  constructor() {
    this.agents = new Map();
    this.agentTypes = {
      'claude': ClaudeAgent,
      'openai': OpenAIAgent,
      'openai-compatible': OpenAIAgent
    };
  }

  /**
   * Initialize agents from database
   */
  initialize() {
    const activeAgents = db.statements.getActiveAgents.all();

    for (const agentData of activeAgents) {
      this.loadAgent(agentData);
    }

    console.log(`[AgentRegistry] Initialized ${this.agents.size} agents`);
  }

  /**
   * Load an agent from database record
   */
  loadAgent(agentData) {
    const AgentClass = this.agentTypes[agentData.type];
    if (!AgentClass) {
      console.warn(`[AgentRegistry] Unknown agent type: ${agentData.type}`);
      return null;
    }

    const config = {
      id: agentData.id,
      name: agentData.name,
      type: agentData.type,
      apiEndpoint: agentData.api_endpoint,
      config: db.parseJSON(agentData.config_json),
      room_id: agentData.room_id,
      rateLimitPerMinute: parseInt(process.env.MAX_AGENT_RESPONSE_PER_MINUTE) || 5
    };

    const agent = new AgentClass(config);
    this.agents.set(agentData.id, agent);

    return agent;
  }

  /**
   * Reload an agent from DB after update (e.g. toggle)
   */
  reloadAgent(agentId) {
    const record = db.statements.getAgent.get(agentId);
    if (!record) {
      this.agents.delete(agentId);
      return null;
    }
    if (!record.active) {
      this.agents.delete(agentId);
      return null;
    }
    return this.loadAgent(record);
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  /**
   * Get agent by name
   */
  getAgentByName(name) {
    for (const [, agent] of this.agents) {
      if (agent.name.toLowerCase() === name.toLowerCase()) {
        return agent;
      }
    }
    return null;
  }

  /**
   * Get all agents
   */
  getAllAgents() {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents for a specific room
   */
  getAgentsByRoom(roomId) {
    return this.getAllAgents().filter(agent => agent.roomId === roomId);
  }

  /**
   * Register a new agent
   */
  async registerAgent(agentData) {
    const { id, name, type, api_endpoint, config_json, room_id } = agentData;

    // Check if agent type is supported
    if (!this.agentTypes[type]) {
      throw new Error(`Unsupported agent type: ${type}`);
    }

    // Create in database
    const config = typeof config_json === 'string' ? config_json : JSON.stringify(config_json || {});

    // Strip leading @ from display names so @mention matching works
    const cleanName = String(name).replace(/^@+/, '').trim();
    db.statements.createAgent.run(id, cleanName, type, api_endpoint, config, room_id, 1);

    // Load into memory
    const dbRecord = db.statements.getAgent.get(id);
    return this.loadAgent(dbRecord);
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId) {
    db.statements.deleteAgent.run(agentId);
    this.agents.delete(agentId);
  }

  /**
   * Toggle agent active status
   */
  toggleAgent(agentId, active) {
    db.statements.toggleAgentActive.run(active ? 1 : 0, agentId);

    if (active) {
      // Re-load (may have been removed from memory)
      this.reloadAgent(agentId);
    } else {
      this.agents.delete(agentId);
    }
  }

  /**
   * Reload all agents from DB (after toggle)
   */
  reloadAll() {
    this.agents.clear();
    this.initialize();
  }

  /**
   * Find agent by mention name (e.g., "@claude" -> agent)
   */
  findAgentByMention(mention) {
    // Try exact name match first
    const agent = this.getAgentByName(mention);
    if (agent) return agent;

    // Try partial match
    for (const [, a] of this.agents) {
      if (a.name.toLowerCase().includes(mention.toLowerCase())) {
        return a;
      }
    }

    return null;
  }

  /**
   * Get health status of all agents
   */
  async getHealthStatus() {
    const results = [];

    for (const [, agent] of this.agents) {
      try {
        const health = await agent.healthCheck();
        results.push(health);
      } catch (error) {
        results.push({
          id: agent.id,
          name: agent.name,
          type: agent.type,
          healthStatus: 'error',
          message: error.message
        });
      }
    }

    return results;
  }
}

// Singleton instance
const registry = new AgentRegistry();

module.exports = registry;