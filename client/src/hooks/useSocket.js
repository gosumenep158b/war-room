import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function useSocket(roomId) {
  const socketRef = useRef(null);
  const listenersRef = useRef(new Map());

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    socketRef.current.on('connect', () => {
      console.log('[Socket] Connected:', socketRef.current.id);
    });

    socketRef.current.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Join/leave room
  useEffect(() => {
    if (!roomId || !socketRef.current) return;

    socketRef.current.emit('room:join', roomId);
    console.log('[Socket] Joined room:', roomId);

    return () => {
      console.log('[Socket] Left room:', roomId);
    };
  }, [roomId]);

  // Subscribe to events
  const on = useCallback((event, callback) => {
    if (!socketRef.current) return;

    socketRef.current.on(event, callback);
    listenersRef.current.set(event, callback);

    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    };
  }, []);

  // Unsubscribe from event
  const off = useCallback((event) => {
    const callback = listenersRef.current.get(event);
    if (callback && socketRef.current) {
      socketRef.current.off(event, callback);
      listenersRef.current.delete(event);
    }
  }, []);

  // Send message
  const sendMessage = useCallback((data) => {
    if (!socketRef.current) {
      console.error('[Socket] Not connected');
      return false;
    }

    socketRef.current.emit('message:send', {
      ...data,
      clientTimestamp: new Date().toISOString()
    });
    return true;
  }, []);

  // Send typing indicator
  const sendTyping = useCallback((userId, username) => {
    if (!socketRef.current || !roomId) return;

    socketRef.current.emit('message:typing', {
      room_id: roomId,
      userId,
      username
    });
  }, [roomId]);

  return {
    socket: socketRef.current,
    connected: socketRef.current?.connected || false,
    on,
    off,
    sendMessage,
    sendTyping
  };
}

export default useSocket;
