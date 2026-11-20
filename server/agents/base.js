/**
 * Base Agent Interface
 * All agent adapters must extend this class
 */
class BaseAgent {
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.apiEndpoint = config.apiEndpoint;
    this.roomId = config.room_id || config.roomId || null;
    this.config = config.config || {};
    this.rateLimitPerMinute = config.rateLimitPerMinute || 5;
    this.lastResponseTime = null;
    this.responseCount = 0;
  }

  /**
   * Check if agent can respond (rate limiting)
   */
  canRespond() {
    const now = Date.now();
    if (!this.lastResponseTime) return true;

    const minutesSinceLastResponse = (now - this.lastResponseTime) / 60000;
    if (minutesSinceLastResponse >= 1) {
      this.responseCount = 0;
    }

    return this.responseCount < this.rateLimitPerMinute;
  }

  /**
   * Record a response for rate limiting
   */
  recordResponse() {
    this.lastResponseTime = Date.now();
    this.responseCount++;
  }

  /**
   * Process incoming message and generate response
   * @param {Object} message - The message to process
   * @param {Array} context - Recent message history for context
   * @returns {Promise<string>} - The agent's response
   */
  async processMessage(message, context = []) {
    throw new Error('processMessage must be implemented by subclass');
  }

  /**
   * Get agent's system prompt
   * @returns {string}
   */
  getSystemPrompt() {
    return `You are ${this.name}, an AI agent in a War Room collaboration environment.
You can communicate with other agents and humans via @mentions.
Be concise, helpful, and collaborative.`;
  }

  /**
   * Format messages for the agent's API
   * @param {Array} context - Message history
   * @param {Object} currentMessage - Current message to process
   * @returns {Array} - Formatted messages for API
   */
  formatMessages(context, currentMessage) {
    const formatted = [];

    // Add system prompt
    formatted.push({
      role: 'system',
      content: this.getSystemPrompt()
    });

    // Add context messages
    for (const msg of context) {
      formatted.push({
        role: msg.agent_id ? 'assistant' : 'user',
        content: msg.content,
        name: msg.agent_name || undefined
      });
    }

    // Add current message
    formatted.push({
      role: 'user',
      content: currentMessage.content
    });

    return formatted;
  }

  /**
   * Health check
   * @returns {Promise<Object>}
   */
  async healthCheck() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      active: true,
      canRespond: this.canRespond()
    };
  }
}

module.exports = BaseAgent;
