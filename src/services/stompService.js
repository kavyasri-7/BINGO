/**
 * Real-Time STOMP WebSocket Service for Spring Boot Backend
 * Connects to ws://localhost:8080/ws (or configured backend URL)
 * Fallback to local network channel if backend is unreachable.
 */

class StompService {
  constructor() {
    this.stompClient = null;
    this.connected = false;
    this.subscriptions = new Map();
    this.listeners = new Map();
  }

  // Connect to Spring Boot WebSocket STOMP endpoint
  connect(backendUrl = 'ws://localhost:8080/ws') {
    return new Promise((resolve) => {
      try {
        // If native WebSocket or Stomp is available
        if (window.SockJS && window.Stomp) {
          const socket = new window.SockJS(backendUrl.replace('ws://', 'http://'));
          this.stompClient = window.Stomp.over(socket);
          this.stompClient.debug = () => {}; // quiet debug

          this.stompClient.connect(
            {},
            (frame) => {
              this.connected = true;
              console.log('Connected to Spring STOMP WebSocket:', frame);
              resolve(true);
            },
            (error) => {
              console.warn('STOMP Connection failed, using simulated client engine:', error);
              this.connected = false;
              resolve(false);
            }
          );
        } else {
          // No STOMP library loaded globally, fall back to simulated real-time channel
          this.connected = false;
          resolve(false);
        }
      } catch (err) {
        console.warn('STOMP init error:', err);
        this.connected = false;
        resolve(false);
      }
    });
  }

  subscribe(destination, callback) {
    if (this.connected && this.stompClient) {
      const sub = this.stompClient.subscribe(destination, (message) => {
        try {
          const data = JSON.parse(message.body);
          callback(data);
        } catch {
          callback(message.body);
        }
      });
      this.subscriptions.set(destination, sub);
    }
  }

  send(destination, body) {
    if (this.connected && this.stompClient) {
      this.stompClient.send(destination, {}, JSON.stringify(body));
    }
  }

  disconnect() {
    if (this.stompClient && this.connected) {
      this.stompClient.disconnect();
      this.connected = false;
    }
  }
}

export const stompService = new StompService();
