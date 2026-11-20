import { useState, useRef, useEffect } from 'react';

export default function MessageBoard({ messages, agents, onSendMessage, currentUserId }) {
  const [inputValue, setInputValue] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!inputValue.trim()) return;

    onSendMessage(inputValue, replyingTo?.id);
    setInputValue('');
    setReplyingTo(null);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function getAuthorName(message) {
    if (message.agent_id) {
      return message.agent_name || 'Agent';
    }
    return 'User';
  }

  function getAuthorColor(message) {
    if (message.agent_id) {
      // Different colors for different agent types
      switch (message.agent_type) {
        case 'claude':
          return '#d4a574'; // Warm brown for Claude
        case 'openai':
          return '#74b9d4'; // Blue for OpenAI
        default:
          return '#a574d4'; // Purple for others
      }
    }
    return 'var(--text-secondary)';
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatContent(content) {
    // Highlight @mentions
    const parts = content.split(/(@[a-zA-Z0-9_-]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} style={styles.mention}>
            {part}
          </span>
        );
      }
      return part;
    });
  }

  return (
    <div style={styles.container}>
      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 ? (
          <div style={styles.empty}>
            <p>No messages yet. Start the conversation!</p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Use @agent to mention specific agents (e.g., @claude)
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isPending = message.status === 'pending';
            const isReply = message.parent_id && message.parent_id !== message.id;

            return (
              <div
                key={message.id}
                style={{
                  ...styles.message,
                  ...(isReply ? styles.reply : {}),
                  ...(isPending ? styles.pending : {})
                }}
              >
                {/* Avatar */}
                <div style={{
                  ...styles.avatar,
                  backgroundColor: getAuthorColor(message)
                }}>
                  {message.agent_id ? '🤖' : '👤'}
                </div>

                {/* Content */}
                <div style={styles.messageContent}>
                  {/* Header */}
                  <div style={styles.messageHeader}>
                    <span style={{
                      ...styles.author,
                      color: getAuthorColor(message)
                    }}>
                      {getAuthorName(message)}
                    </span>
                    <span style={styles.time}>
                      {formatTime(message.created_at)}
                    </span>
                    {isPending && (
                      <span style={styles.pendingBadge}>Thinking...</span>
                    )}
                  </div>

                  {/* Reply indicator */}
                  {isReply && replyingTo && (
                    <div style={styles.replyPreview}>
                      Replying to {replyingTo.content?.substring(0, 50)}...
                    </div>
                  )}

                  {/* Body */}
                  <div style={styles.messageBody}>
                    {formatContent(message.content)}
                  </div>

                  {/* Actions */}
                  <div style={styles.messageActions}>
                    <button
                      onClick={() => setReplyingTo(message)}
                      style={styles.actionButton}
                    >
                      Reply
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputContainer}>
        {replyingTo && (
          <div style={styles.replyBar}>
            <span>Replying to: {replyingTo.content?.substring(0, 60)}...</span>
            <button
              onClick={() => setReplyingTo(null)}
              style={styles.cancelReply}
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.inputForm}>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              replyingTo
                ? 'Reply...'
                : 'Message room... Use @ to mention agents'
            }
            style={styles.input}
          />
          <button type="submit" style={styles.sendButton}>
            Send
          </button>
        </form>

        <div style={styles.hints}>
          <span>@agent</span> to mention an agent
          <span style={styles.hintSeparator}>•</span>
          <span>Enter</span> to send
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    overflow: 'hidden'
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px'
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'var(--text-secondary)'
  },
  message: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    maxWidth: '800px'
  },
  reply: {
    marginLeft: '32px',
    paddingLeft: '12px',
    borderLeft: '2px solid var(--border)'
  },
  pending: {
    opacity: 0.7
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    flexShrink: 0
  },
  messageContent: {
    flex: 1,
    minWidth: 0
  },
  messageHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px'
  },
  author: {
    fontWeight: 600,
    fontSize: '14px'
  },
  time: {
    fontSize: '12px',
    color: 'var(--text-secondary)'
  },
  pendingBadge: {
    fontSize: '11px',
    color: 'var(--warning)',
    backgroundColor: 'rgba(210, 153, 34, 0.1)',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  replyPreview: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    fontStyle: 'italic'
  },
  messageBody: {
    fontSize: '14px',
    lineHeight: 1.5,
    wordBreak: 'break-word'
  },
  mention: {
    color: 'var(--accent)',
    fontWeight: 500,
    cursor: 'pointer'
  },
  messageActions: {
    display: 'flex',
    gap: '8px',
    marginTop: '6px'
  },
  actionButton: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 8px',
    borderRadius: '4px'
  },
  inputContainer: {
    borderTop: '1px solid var(--border)',
    padding: '16px 20px',
    backgroundColor: 'var(--bg-secondary)'
  },
  replyBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '6px',
    marginBottom: '8px',
    fontSize: '13px'
  },
  cancelReply: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '0 4px'
  },
  inputForm: {
    display: 'flex',
    gap: '10px'
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none'
  },
  sendButton: {
    padding: '12px 24px',
    backgroundColor: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  hints: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '8px',
    fontSize: '11px',
    color: 'var(--text-secondary)'
  },
  hintSeparator: {
    color: 'var(--border)'
  }
};
