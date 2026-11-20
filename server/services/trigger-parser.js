const agentRegistry = require('../agents/registry');

/**
 * Trigger Parser Service
 * Parses @agent mentions from messages and routes to appropriate agents
 */
class TriggerParser {
  constructor() {
    // Pattern to match @agent mentions
    this.mentionPattern = /@([a-zA-Z0-9_-]+)/g;
    // Pattern to detect if message is directed at specific agent
    this.directedPattern = /^@([a-zA-Z0-9_-]+)\s*[:：]/i;
  }

  /**
   * Extract all @mentions from a message
   * @param {string} content - Message content
   * @returns {Array<string>} - List of mentioned agent names
   */
  extractMentions(content) {
    const matches = content.match(this.mentionPattern);
    if (!matches) return [];

    // Remove @ prefix and deduplicate
    return [...new Set(matches.map(m => m.substring(1)))];
  }

  /**
   * Check if message is directed at a specific agent
   * @param {string} content - Message content
   * @returns {Object|null} - { agentName, content } or null
   */
  extractDirectedMessage(content) {
    const match = content.match(this.directedPattern);
    if (!match) return null;

    return {
      agentName: match[1],
      content: content.replace(this.directedPattern, '').trim()
    };
  }

  /**
   * Parse message and determine target agents
   * @param {string} content - Message content
   * @param {string} roomId - Room ID for filtering agents
   * @returns {Object} - { targets: Array<Agent>, isBroadcast: boolean, directedTo: string|null }
   */
  parseMessage(content, roomId = null) {
    const mentions = this.extractMentions(content);
    const directed = this.extractDirectedMessage(content);

    let targetAgents = [];
    let isBroadcast = false;

    // Check for @all broadcast
    if (mentions.includes('all')) {
      isBroadcast = true;
      const roomAgents = roomId
        ? agentRegistry.getAgentsByRoom(roomId)
        : agentRegistry.getAllAgents();
      targetAgents = roomAgents.filter(a => a.canRespond());
    } else if (mentions.length > 0) {
      // Find agents by mention names
      for (const mention of mentions) {
        const agent = agentRegistry.findAgentByMention(mention);
        if (agent && agent.canRespond()) {
          targetAgents.push(agent);
        }
      }
    } else if (directed) {
      // Message directed at specific agent (e.g., "@claude: hello")
      const agent = agentRegistry.findAgentByMention(directed.agentName);
      if (agent && agent.canRespond()) {
        targetAgents.push(agent);
      }
    }

    return {
      targets: targetAgents,
      isBroadcast,
      directedTo: directed ? directed.agentName : null,
      mentions,
      cleanedContent: directed ? directed.content : content
    };
  }

  /**
   * Format message for agent processing
   * Includes context about mentions and conversation thread
   * @param {Object} message - Original message object
   * @param {Array} context - Recent message history
   * @returns {Object} - Formatted message for agent
   */
  formatForAgent(message, context = []) {
    return {
      id: message.id,
      room_id: message.room_id,
      agent_id: message.agent_id,
      content: message.content,
      mentions: this.extractMentions(message.content),
      context: context.map(msg => ({
        id: msg.id,
        agent_id: msg.agent_id,
        agent_name: msg.agent_name,
        content: msg.content,
        created_at: msg.created_at
      }))
    };
  }

  /**
   * Check if message should trigger auto-response from agents
   * (e.g., agents might respond to questions even without @mention)
   * @param {string} content - Message content
   * @returns {boolean}
   */
  shouldTriggerAutoResponse(content) {
    // Auto-trigger patterns (can be customized per agent)
    const autoTriggerPatterns = [
      /\?$/,  // Questions
      /^(please|pls)\b/i,  // Polite requests
      /^help\b/i,  // Help requests
    ];

    return autoTriggerPatterns.some(pattern => pattern.test(content));
  }
}

module.exports = new TriggerParser();
