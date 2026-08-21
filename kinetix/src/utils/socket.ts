/// <reference types="vite/client" />
import { io, Socket } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

class SocketService {
  public socket: Socket | null = null;
  private backendUrl: string;

  constructor(url: string) {
    this.backendUrl = url;
  }

  public connect() {
    if (!this.socket) {
      this.socket = io(this.backendUrl);

      this.socket.on('connect', () => {
        console.log('Connected to backend telemetry server:', this.socket?.id);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from backend telemetry server');
      });
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService(BACKEND_URL);
