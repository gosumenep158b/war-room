const { v4: uuidv4 } = require('uuid');
const agentRegistry = require('../agents/registry');
const { db, statements } = require('../db');
const triggerParser = require('./trigger-parser');

/**
 * Message Queue Service
 * Handles async message delivery to agents and response processing
 */
class MessageQueue {
  constructor(io) {
    this.io = io;
    this.queue = [];
    this.processing = false;
    this.timeoutMs = parseInt(process.env.AGENT_RESPONSE_TIMEOUT_MS) || 60000;
  }

  /**
   * Queue a message for agent processing
   * @param {Object} message - Message object
   * @param {Array} targetAgents - Agents to process this message
   */
  async queueForAgents(message, targetAgents) {
    if (targetAgents.length === 0) {
      return;
    }

    const jobId = uuidv4();
    const job = {
      id: jobId,
      message,
      targets: targetAgents,
      createdAt: Date.now(),
      status: 'pending'
    };

    this.queue.push(job);
    console.log(`[MessageQueue] Queued job ${jobId} for ${targetAgents.length} agents`);

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }

    return jobId;
  }

  /**
   * Process the message queue
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.shift();
      await this.processJob(job);
    }

    this.processing = false;
  }

  /**
   * Process a single queue job
   * @param {Object} job - Job to process
   */
  async processJob(job) {
    const { message, targets } = job;
    job.status = 'processing';

    console.log(`[MessageQueue] Processing job ${job.id} for ${targets.length} agents`);

    // Get recent message history for context
    const context = this.getMessageContext(message.room_id, message.id);

    // Process for each target agent
    const promises = targets.map(async (agent) => {
      try {
        // Create pending message for agent response
        const responseId = uuidv4();
        const pendingMessage = {
          id: responseId,
          room_id: message.room_id,
          agent_id: agent.id,
          content: 'Thinking...',
          status: 'pending',
          parent_id: message.id,
          thread_id: message.thread_id || message.id
        };

        // Broadcast that agent is thinking
        this.io.to(message.room_id).emit('message:pending', pendingMessage);

        // Process with timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Agent response timeout')), this.timeoutMs)
        );

        const responsePromise = agent.processMessage(message, context);
        const response = await Promise.race([responsePromise, timeoutPromise]);

        // Store agent response
        const storedMessage = this.storeAgentResponse({
          ...pendingMessage,
          content: response,
          status: 'sent'
        });

        // Broadcast the response
        this.io.to(message.room_id).emit('message:new', storedMessage);

        console.log(`[MessageQueue] Agent ${agent.name} responded to message ${message.id}`);

        // Check if response contains @mentions that should trigger other agents
        const responseMentions = triggerParser.extractMentions(response);
        if (responseMentions.length > 0) {
          await this.handleAgentMentionsInResponse(storedMessage, responseMentions);
        }

        return { success: true, agent: agent.name };
      } catch (error) {
        console.error(`[MessageQueue] Agent ${agent.name} failed: ${error.message}`);

        // Broadcast error
        this.io.to(message.room_id).emit('message:error', {
          agent_id: agent.id,
          agent_name: agent.name,
          error: error.message,
          parent_id: message.id
        });

        return { success: false, agent: agent.name, error: error.message };
      }
    });

    const results = await Promise.allSettled(promises);
    job.status = 'completed';

    console.log(`[MessageQueue] Job ${job.id} completed:`, results);
  }

  /**
   * Get recent message context for an agent
   */
  getMessageContext(roomId, currentMessageId, limit = 10) {
    try {
      const messages = statements.getRecentMessages.all(roomId, limit);
      // Filter out messages after the current one (in case of race conditions)
      const currentIndex = messages.findIndex(m => m.id === currentMessageId);
      if (currentIndex >= 0) {
        return messages.slice(0, currentIndex);
      }
      return messages;
    } catch (error) {
      console.error('[MessageQueue] Error getting context:', error.message);
      return [];
    }
  }

  /**
   * Store agent response in database
   */
  storeAgentResponse(messageData) {
    const metadata = JSON.stringify({
      responseTo: messageData.parent_id,
      processedAt: new Date().toISOString()
    });

    statements.createMessage.run(
      messageData.id,
      messageData.room_id,
      messageData.agent_id,
      messageData.content,
      '[]',
      messageData.parent_id,
      messageData.thread_id,
      messageData.status,
      metadata
    );

    return {
      ...messageData,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Handle agent mentions in agent responses (chain reactions)
   */
  async handleAgentMentionsInResponse(message, mentions) {
    for (const mention of mentions) {
      const targetAgent = agentRegistry.findAgentByMention(mention);
      if (targetAgent && targetAgent.canRespond() && targetAgent.id !== message.agent_id) {
        // Queue this message for the mentioned agent
        await this.queueForAgents(message, [targetAgent]);
      }
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      jobs: this.queue.map(j => ({
        id: j.id,
        status: j.status,
        targets: j.targets.map(t => t.name)
      }))
    };
  }
}

module.exports = MessageQueue;
