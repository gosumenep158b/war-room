const { io } = require('socket.io-client');

const SOCKET_URL = 'http://localhost:3001';
const ROOM_ID = '6ce07d83-c8ae-4d1b-8ba0-9d7a622ade72'; // Room "test"

const socket = io(SOCKET_URL);

socket.on('connect', () => {
  console.log('Connected to server');
  socket.emit('room:join', ROOM_ID);
});

socket.on('room:history', (history) => {
  console.log(`Loaded ${history.length} messages from history`);

  // Send test message mentioning claude
  setTimeout(() => {
    console.log('Sending test message: @claude halo, apa kabar?');
    socket.emit('message:send', {
      room_id: ROOM_ID,
      content: '@claude halo, apa kabar?',
      clientTimestamp: new Date().toISOString()
    });
  }, 1000);
});

socket.on('message:new', (msg) => {
  const author = msg.agent_id ? `[Agent: ${msg.agent_name}]` : '[User]';
  console.log(`${author}: ${msg.content.substring(0, 100)}`);
});

socket.on('message:pending', (msg) => {
  console.log(`[Pending] ${msg.agent_name}: Thinking...`);
});

socket.on('message:error', (err) => {
  console.error('[Error]', err.error);
});

// Keep connection open for 30 seconds to receive response
setTimeout(() => {
  console.log('Test complete');
  socket.disconnect();
  process.exit(0);
}, 30000);
