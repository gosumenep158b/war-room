const BaseAgent = require('./base');

/**
 * Claude Agent Adapter (Anthropic Messages API)
 * Uses Node's built-in global fetch (Node >= 18).
 */
class ClaudeAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.apiUrl = this.config.apiUrl
      || this.apiEndpoint
      || process.env.CLAUDE_API_URL
      || 'https://api.anthropic.com/v1/messages';
    this.apiKey = this.config.apiKey || process.env.CLAUDE_API_KEY;
    this.model = this.config.model || process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';
    this.maxTokens = this.config.maxTokens || 1024;
  }

  async getSystemPrompt() {
    return this.config.systemPrompt || `You are ${this.name}, an AI agent participating in a shared War Room.
Other participants (humans and AI agents) communicate here. Messages may mention you with @${this.name}.
Be concise, helpful, and collaborative. If you want to hand work to another agent, mention them with @name.
Do not prefix every reply with your own name; just answer.`;
  }

  /**
   * Build a transcript string from context + current message.
   * Claude's Messages API requires alternating user/assistant turns beginning
   * with a user turn, so a flattened transcript inside one user message is the
   * most robust representation for a free-form multi-agent board.
   */
  buildTranscript(context, currentMessage) {
    const lines = [];

    for (const msg of context) {
      const speaker = msg.agent_id ? (msg.agent_name || 'Agent') : 'Human';
      lines.push(`${speaker}: ${msg.content}`);
    }

    const speaker = currentMessage.agent_id
      ? (currentMessage.agent_name || 'Agent')
      : 'Human';
    lines.push(`${speaker}: ${currentMessage.content}`);

    return lines.join('\n\n');
  }

  async processMessage(message, context = []) {
    if (!this.apiKey) {
      return `[${this.name}] API key is not configured. Set CLAUDE_API_KEY in .env to enable this agent.`;
    }

    if (!this.canRespond()) {
      return `[${this.name}] Rate limited. Please wait a moment before sending another message.`;
    }

    const transcript = this.buildTranscript(context, message);
    const systemPrompt = await this.getSystemPrompt();

    const payload = {
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Here is the War Room conversation so far:\n\n${transcript}\n\nRespond to the latest message as ${this.name}.`
        }
      ]
    };

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      parseInt(process.env.AGENT_RESPONSE_TIMEOUT_MS) || 60000
    );

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ClaudeAgent] API error ${response.status}: ${errorText}`);
        return `[${this.name}] API error ${response.status}. Check server logs for details.`;
      }

      const data = await response.json();

      // Anthropic response: { content: [{ type: 'text', text: '...' }, ...] }
      const text = Array.isArray(data.content)
        ? data.content
            .filter((block) => block.type === 'text')
            .map((block) => block.text)
            .join('\n')
        : '';

      this.recordResponse();

      return text.trim() || `[${this.name}] No text response received.`;
    } catch (error) {
      if (error.name === 'AbortError') {
        return `[${this.name}] Response timed out.`;
      }
      console.error(`[ClaudeAgent] processMessage error: ${error.message}`);
      return `[${this.name}] Error: ${error.message}`;
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      active: true,
      canRespond: this.canRespond(),
      healthStatus: this.apiKey ? 'ok' : 'unconfigured',
      model: this.model,
      message: this.apiKey
        ? 'API key present'
        : 'Missing CLAUDE_API_KEY'
    };
  }
}

module.exports = ClaudeAgent;
