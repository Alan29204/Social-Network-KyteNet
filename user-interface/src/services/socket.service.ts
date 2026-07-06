import { io, Socket } from 'socket.io-client';

/**
 * Singleton Socket.IO service for real-time communication.
 *
 * Architecture:
 * - Auto-reconnect enabled with exponential backoff
 * - User auto-joins their personal userId room on server connect
 * - All messages from all chat rooms are received via userId broadcast
 * - No need to join/leave individual chat rooms
 */
class SocketService {
  private socket: Socket | null = null;
  private readonly URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly HEARTBEAT_MS = 30_000;

  /** Gửi heartbeat định kỳ để server gia hạn presence key (giữ online). */
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) this.socket.emit('heartbeat');
    }, this.HEARTBEAT_MS);
  }
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Connect to WebSocket server with authentication token */
  connect(token: string) {
    if (!this.socket) {
      this.socket = io(this.URL, {
        auth: {
          token,
        },
        transports: ['websocket'],
        // Auto-reconnect with exponential backoff
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.socket.on('connect', () => {
        console.log('Socket connected:', this.socket?.id);
        this.socket?.emit('heartbeat');
        this.startHeartbeat();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        this.stopHeartbeat();
      });

      this.socket.on('reconnect', (attemptNumber: number) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
      });

      this.socket.on('reconnect_error', (error: Error) => {
        console.warn('Socket reconnect error:', error.message);
      });
    }
  }

  /** Disconnect from WebSocket server */
  disconnect() {
    this.stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /** Get the raw socket instance for event listening */
  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();
