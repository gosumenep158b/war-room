export default function RoomSelector({ rooms, currentRoom, onSelectRoom, onCreateRoom }) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Rooms</span>
        <button onClick={onCreateRoom} style={styles.createButton}>
          +
        </button>
      </div>

      <div style={styles.list}>
        {rooms.length === 0 ? (
          <div style={styles.empty}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              No rooms yet
            </p>
          </div>
        ) : (
          rooms.map(room => (
            <button
              key={room.id}
              onClick={() => onSelectRoom(room)}
              style={{
                ...styles.roomButton,
                ...(currentRoom?.id === room.id ? styles.active : {})
              }}
            >
              <span style={styles.roomIcon}>📍</span>
              <span style={styles.roomName}>{room.name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '16px',
    borderBottom: '1px solid var(--border)'
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
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  empty: {
    padding: '12px 0'
  },
  roomButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 0.15s'
  },
  active: {
    backgroundColor: 'var(--bg-tertiary)'
  },
  roomIcon: {
    fontSize: '14px'
  },
  roomName: {
    fontSize: '14px',
    color: 'var(--text-primary)'
  }
};
