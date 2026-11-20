// OpenAI-compatible agent adapter: works with any OpenAI-style /v1/chat/completions
// endpoint (OpenAI, LightVela gateway, self-hosted vLLM, etc).
const BaseAgent = require('./base');

class OpenAIAgent extends BaseAgent {
  constructor(config) {
    super(config);
    this.apiUrl = this.config.apiUrl
      || this.apiEndpoint
      || process.env.OPENAI_API_URL
      || 'https://api.openai.com/v1/chat/completions';
    this.apiKey = this.config.apiKey || process.env.OPENAI_API_KEY;
    this.model = this.config.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.maxTokens = this.config.maxTokens || 1024;
  }

  async getSystemPrompt() {
    return this.config.systemPrompt || `You are ${this.name}, an AI agent participating in a shared War Room.
Other participants (humans and AI agents) communicate here. Messages may mention you with @${this.name}.
Be concise, helpful, and collaborative. If you want to hand work to another agent, mention them with @name.
Do not prefix every reply with your own name; just answer.`;
  }

  /** Not used; the messages array is built inline in processMessage. */
  buildMessages() {
    throw new Error('buildMessages is not used; see processMessage');
  }

  async processMessage(message, context = []) {
    if (!this.apiKey) {
      return `[${this.name}] API key is not configured. Set OPENAI_API_KEY in .env to enable this agent.`;
    }

    if (!this.canRespond()) {
      return `[${this.name}] Rate limited. Please wait a moment before sending another message.`;
    }

    const systemPrompt = await this.getSystemPrompt();

    // Flatten the board into one user message: multi-agent chatter is not a
    // strict user/assistant alternation, so a transcript is the robust shape.
    const lines = [];
    for (const msg of context) {
      const speaker = msg.agent_id ? (msg.agent_name || 'Agent') : 'Human';
      lines.push(`${speaker}: ${msg.content}`);
    }
    const speaker = message.agent_id
      ? (message.agent_name || 'Agent')
      : 'Human';
    lines.push(`${speaker}: ${message.content}`);
    const transcript = lines.join('\n\n');

    const payload = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
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
          'authorization': `Bearer ${this.apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[OpenAIAgent] API error ${response.status}: ${errorText}`);
        return `[${this.name}] API error ${response.status}. Check server logs for details.`;
      }

      const data = await response.json();

      // OpenAI response: { choices: [{ message: { content: '...' } }] }
      const text = data.choices?.[0]?.message?.content || '';

      this.recordResponse();

      return text.trim() || `[${this.name}] No text response received.`;
    } catch (error) {
      if (error.name === 'AbortError') {
        return `[${this.name}] Response timed out.`;
      }
      console.error(`[OpenAIAgent] processMessage error: ${error.message}`);
      return `[${this.name}] Error: ${error.message}`;
    } finally {
      clearTimeout(timeout);
    }
  }

  async healthCheck() {
    if (!this.apiKey) return { ok: false, reason: 'no api key' };
    return { ok: true };
  }
}

module.exports = OpenAIAgent;
