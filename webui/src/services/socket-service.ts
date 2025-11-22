export class SocketService {
  private ws: WebSocket;
  private listeners: Map<string, Function[]> = new Map();
  
  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/socket.io`;
    
    this.ws = new WebSocket(url, 'socketio');
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const eventName = data[0];
        const eventData = data[1];
        
        const callbacks = this.listeners.get(eventName);
        if (callbacks) {
          callbacks.forEach(cb => cb(eventData));
        }
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      // Auto-reconnect after 2 seconds
      setTimeout(() => {
        new SocketService();
      }, 2000);
    };
  }
  
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }
  
  emit(event: string, data: any) {
    if (this.ws.readyState === WebSocket.OPEN) {
      const message = JSON.stringify([event, data]);
      this.ws.send(message);
    }
  }
  
  disconnect() {
    this.ws.close();
  }
}

