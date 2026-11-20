export default function AgentPanel({ agents, onToggleAgent, onCreateAgent }) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Agents</span>
        <button onClick={onCreateAgent} style={styles.createButton}>
          +
        </button>
      </div>

      <div style={styles.list}>
        {agents.length === 0 ? (
          <div style={styles.empty}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              No agents registered
            </p>
            <button onClick={onCreateAgent} style={styles.addButton}>
              Add Agent
            </button>
          </div>
        ) : (
          agents.map(agent => (
            <div key={agent.id} style={styles.agentCard}>
              <div style={styles.agentHeader}>
                <div style={styles.agentInfo}>
                  <span style={styles.agentIcon}>
                    {agent.type === 'claude' ? '🧠' : '🤖'}
                  </span>
                  <div>
                    <div style={styles.agentName}>{agent.name}</div>
                    <div style={styles.agentType}>{agent.type}</div>
                  </div>
                </div>
                <label style={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={agent.canRespond}
                    onChange={(e) => onToggleAgent(agent.id, e.target.checked)}
                    style={styles.checkbox}
                  />
                  <span style={{
                    ...styles.toggleSlider,
                    backgroundColor: agent.canRespond ? 'var(--success)' : 'var(--border)'
                  }} />
                </label>
              </div>

              <div style={styles.agentStatus}>
                <span style={{
                  ...styles.statusDot,
                  backgroundColor: agent.canRespond ? 'var(--success)' : 'var(--text-secondary)'
                }} />
                {agent.canRespond ? 'Ready' : 'Disabled'}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={styles.help}>
        <p style={styles.helpText}>
          Agents respond when mentioned with <code style={styles.code}>@name</code>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  title: {
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--text-secondary)'
  },
  createButton: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  empty: {
    padding: '20px 12px',
    textAlign: 'center'
  },
  addButton: {
    padding: '8px 16px',
    backgroundColor: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer'
  },
  agentCard: {
    padding: '12px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '8px',
    border: '1px solid var(--border)'
  },
  agentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  agentInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  agentIcon: {
    fontSize: '18px'
  },
  agentName: {
    fontSize: '14px',
    fontWeight: 500
  },
  agentType: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    textTransform: 'capitalize'
  },
  toggle: {
    position: 'relative',
    width: '36px',
    height: '20px',
    cursor: 'pointer'
  },
  checkbox: {
    opacity: 0,
    width: 0,
    height: 0,
    position: 'absolute'
  },
  toggleSlider: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: '20px',
    transition: '0.2s',
    cursor: 'pointer'
  },
  agentStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    color: 'var(--text-secondary)'
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%'
  },
  help: {
    marginTop: '12px',
    padding: '10px',
    backgroundColor: 'var(--bg-tertiary)',
    borderRadius: '6px',
    border: '1px solid var(--border)'
  },
  helpText: {
    fontSize: '11px',
    color: 'var(--text-secondary)',
    margin: 0
  },
  code: {
    backgroundColor: 'var(--bg-secondary)',
    padding: '2px 4px',
    borderRadius: '3px',
    fontFamily: 'monospace',
    fontSize: '10px'
  }
};
