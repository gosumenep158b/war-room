import { useState, useEffect, useRef } from 'react';
import { useSocket } from './hooks/useSocket';
import api from './api/client';
import MessageBoard from './components/MessageBoard';
import AgentPanel from './components/AgentPanel';
import RoomSelector from './components/RoomSelector';

function App() {
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [agents, setAgents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [showNewRoomModal, setShowNewRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [showAgentModal, setShowAgentModal] = useState(false);

  const { connected, sendMessage, on } = useSocket(currentRoom?.id);

  // Load rooms on mount
  useEffect(() => {
    loadRooms();
  }, []);

  // Load room data when room changes
  useEffect(() => {
    if (currentRoom) {
      loadRoomData(currentRoom.id);
    }
  }, [currentRoom]);

  // Socket event listeners
  useEffect(() => {
    if (!currentRoom) return;

    const cleanupFunctions = [];

    cleanupFunctions.push(on('room:history', (history) => {
      setMessages(history);
    }));

    cleanupFunctions.push(on('room:agents', (roomAgents) => {
      setAgents(roomAgents);
    }));

    cleanupFunctions.push(on('message:new', (message) => {
      setMessages(prev => [...prev, message]);
    }));

    cleanupFunctions.push(on('message:pending', (message) => {
      setMessages(prev => [...prev, message]);
    }));

    cleanupFunctions.push(on('message:error', (error) => {
      console.error('[App] Message error:', error);
    }));

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [currentRoom, on]);

  async function loadRooms() {
    try {
      const response = await api.getRooms();
      setRooms(response.data || []);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  }

  async function loadRoomData(roomId) {
    try {
      const [messagesRes, agentsRes] = await Promise.all([
        api.getRoomMessages(roomId, 100),
        api.getRoomAgents(roomId)
      ]);
      setMessages(messagesRes.data || []);
      setAgents(agentsRes.data || []);
    } catch (error) {
      console.error('Failed to load room data:', error);
    }
  }

  async function handleCreateRoom(e) {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    try {
      const response = await api.createRoom(newRoomName.trim());
      const newRoom = response.data;
      setRooms(prev => [...prev, newRoom]);
      setCurrentRoom(newRoom);
      setNewRoomName('');
      setShowNewRoomModal(false);
    } catch (error) {
      console.error('Failed to create room:', error);
      alert('Failed to create room: ' + error.message);
    }
  }

  async function handleSendMessage(content, parent_id = null) {
    if (!currentRoom || !content.trim()) return;

    const messageData = {
      room_id: currentRoom.id,
      content: content.trim(),
      parent_id
    };

    const success = sendMessage(messageData);
    if (!success) {
      alert('Not connected to server');
    }
  }

  async function handleCreateAgent(agentData) {
    try {
      await api.createAgent(
        agentData.name,
        agentData.type,
        agentData.api_endpoint,
        agentData.config,
        currentRoom.id
      );
      setShowAgentModal(false);
      loadRoomData(currentRoom.id);
    } catch (error) {
      console.error('Failed to create agent:', error);
      alert('Failed to create agent: ' + error.message);
    }
  }

  async function handleToggleAgent(agentId, active) {
    try {
      await api.toggleAgent(agentId, active);
      loadRoomData(currentRoom.id);
    } catch (error) {
      console.error('Failed to toggle agent:', error);
    }
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>🛡️ War Room</h1>
        <div style={styles.headerRight}>
          <span style={{
            ...styles.status,
            color: connected ? 'var(--success)' : 'var(--error)'
          }}>
            {connected ? '● Connected' : '○ Disconnected'}
          </span>
        </div>
      </header>

      <div style={styles.main}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <RoomSelector
            rooms={rooms}
            currentRoom={currentRoom}
            onSelectRoom={setCurrentRoom}
            onCreateRoom={() => setShowNewRoomModal(true)}
          />

          {currentRoom && (
            <AgentPanel
              agents={agents}
              onToggleAgent={handleToggleAgent}
              onCreateAgent={() => setShowAgentModal(true)}
            />
          )}
        </aside>

        {/* Main content */}
        <main style={styles.content}>
          {currentRoom ? (
            <MessageBoard
              messages={messages}
              agents={agents}
              onSendMessage={handleSendMessage}
              currentUserId="user"
            />
          ) : (
            <div style={styles.emptyState}>
              <h2>Welcome to War Room</h2>
              <p>Select a room from the sidebar or create a new one to start collaborating with AI agents.</p>
              <button
                style={styles.primaryButton}
                onClick={() => setShowNewRoomModal(true)}
              >
                Create Your First Room
              </button>
            </div>
          )}
        </main>
      </div>

      {/* New Room Modal */}
      {showNewRoomModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2>Create New Room</h2>
            <form onSubmit={handleCreateRoom}>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name..."
                style={styles.input}
                autoFocus
              />
              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowNewRoomModal(false)}
                  style={styles.secondaryButton}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.primaryButton}>
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Agent Modal - simplified inline */}
      {showAgentModal && (
        <AgentModal
          onClose={() => setShowAgentModal(false)}
          onCreate={handleCreateAgent}
        />
      )}
    </div>
  );
}

// Agent Modal Component
function AgentModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    name: '',
    type: 'claude',
    api_endpoint: '',
    config: { apiKey: '', systemPrompt: '' }
  });

  function handleSubmit(e) {
    e.preventDefault();
    onCreate(formData);
  }

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <h2>Register New Agent</h2>
        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Agent Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="@claude"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Agent Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              style={styles.input}
            >
              <option value="openai-compatible">OpenAI-compatible (LightVela, dsb.)</option>
              <option value="openai">OpenAI (api.openai.com)</option>
              <option value="claude">Claude (Anthropic)</option>
            </select>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>System Prompt / Kepribadian (opsional)</label>
            <textarea
              value={formData.config.systemPrompt}
              onChange={(e) => setFormData({ ...formData, config: { ...formData.config, systemPrompt: e.target.value } })}
              placeholder="Kamu adalah Muse, kurator konten kreatif..."
              rows={3}
              style={{ ...styles.input, resize: 'vertical' }}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>API Key (kosongkan untuk pakai key server)</label>
            <input
              type="password"
              value={formData.config.apiKey}
              onChange={(e) => setFormData({ ...formData, config: { ...formData.config, apiKey: e.target.value } })}
              placeholder="sk-ant-api03-..."
              style={styles.input}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>API Endpoint (optional)</label>
            <input
              type="url"
              value={formData.api_endpoint}
              onChange={(e) => setFormData({ ...formData, api_endpoint: e.target.value })}
              placeholder="https://api.anthropic.com"
              style={styles.input}
            />
          </div>

          <div style={styles.modalActions}>
            <button
              type="button"
              onClick={onClose}
              style={styles.secondaryButton}
            >
              Cancel
            </button>
            <button type="submit" style={styles.primaryButton}>
              Register Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Styles
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg-secondary)'
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  status: {
    fontSize: '13px'
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden'
  },
  sidebar: {
    width: '280px',
    borderRight: '1px solid var(--border)',
    backgroundColor: 'var(--bg-secondary)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '40px',
    textAlign: 'center'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'var(--bg-secondary)',
    borderRadius: '8px',
    padding: '24px',
    width: '100%',
    maxWidth: '400px',
    border: '1px solid var(--border)'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  formGroup: {
    marginBottom: '16px'
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '13px',
    color: 'var(--text-secondary)'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px'
  },
  primaryButton: {
    padding: '10px 16px',
    backgroundColor: 'var(--accent)',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  secondaryButton: {
    padding: '10px 16px',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer'
  }
};

export default App;
