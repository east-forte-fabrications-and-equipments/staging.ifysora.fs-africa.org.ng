import { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { EventBus } from '../events/EventBus.js';
import { logger } from '../../utils/logger.js';
import jwt from 'jsonwebtoken';

interface WebSocketClient {
  ws: WebSocket;
  userId: string;
  subscriptions: Set<string>;
}

export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private eventBus: EventBus;

  constructor(server: HTTPServer) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this),
    });
    
    this.eventBus = EventBus.getInstance();
    this.setupWebSocketHandlers();
    this.setupEventListeners();
  }

  private verifyClient(info: any, cb: (res: boolean) => void): void {
    const token = info.req.url?.split('token=')[1];
    
    if (!token) {
      cb(false);
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || '');
      (info.req as any).user = decoded;
      cb(true);
    } catch (error) {
      cb(false);
    }
  }

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws, req) => {
      const user = (req as any).user;
      const clientId = user.sub;

      const client: WebSocketClient = {
        ws,
        userId: clientId,
        subscriptions: new Set(),
      };

      this.clients.set(clientId, client);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(client, data);
        } catch (error) {
          logger.error('WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            payload: { message: 'Invalid message format' },
          }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info(`WebSocket client disconnected: ${clientId}`);
      });

      ws.send(JSON.stringify({
        type: 'connected',
        payload: { clientId, timestamp: new Date().toISOString() },
      }));

      logger.info(`WebSocket client connected: ${clientId}`);
    });
  }

  private handleMessage(client: WebSocketClient, data: any): void {
    switch (data.type) {
      case 'subscribe':
        client.subscriptions.add(data.topic);
        client.ws.send(JSON.stringify({
          type: 'subscribed',
          payload: { topic: data.topic },
        }));
        break;

      case 'unsubscribe':
        client.subscriptions.delete(data.topic);
        client.ws.send(JSON.stringify({
          type: 'unsubscribed',
          payload: { topic: data.topic },
        }));
        break;

      default:
        client.ws.send(JSON.stringify({
          type: 'error',
          payload: { message: 'Unknown message type' },
        }));
    }
  }

  private setupEventListeners(): void {
    this.eventBus.subscribe('measurement.progress', this.handleProgress.bind(this));
    this.eventBus.subscribe('measurement.completed', this.handleCompleted.bind(this));
    this.eventBus.subscribe('measurement.failed', this.handleFailed.bind(this));
  }

  private handleProgress(event: any): void {
    this.broadcastToUser(event.metadata.userId, {
      type: 'progress',
      payload: {
        measurementId: event.payload.measurementId,
        progress: event.payload.progress,
        message: event.payload.message,
        timestamp: event.timestamp,
      },
    });
  }

  private handleCompleted(event: any): void {
    this.broadcastToUser(event.metadata.userId, {
      type: 'completed',
      payload: {
        measurementId: event.payload.measurementId,
        result: event.payload.result,
        timestamp: event.timestamp,
      },
    });
  }

  private handleFailed(event: any): void {
    this.broadcastToUser(event.metadata.userId, {
      type: 'failed',
      payload: {
        measurementId: event.payload.measurementId,
        error: event.payload.error,
        timestamp: event.timestamp,
      },
    });
  }

  private broadcastToUser(userId: string, message: any): void {
    const client = this.clients.get(userId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  broadcast(topic: string, message: any): void {
    for (const client of this.clients.values()) {
      if (client.subscriptions.has(topic)) {
        client.ws.send(JSON.stringify(message));
      }
    }
  }
}
