import { Redis } from 'ioredis';
import { logger } from '../../utils/logger.js';

export interface Event {
  id: string;
  type: string;
  timestamp: Date;
  payload: any;
  metadata: {
    userId: string;
    correlationId: string;
    source: string;
  };
}

export class EventBus {
  private static instance: EventBus;
  private redis: Redis;
  private subscribers: Map<string, ((event: Event) => Promise<void>)[]> = new Map();

  private constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.startConsumer();
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  async publish(event: Event): Promise<void> {
    try {
      // Store in Redis stream for persistence
      await this.redis.xadd(
        'events',
        '*',
        'id', event.id,
        'type', event.type,
        'timestamp', event.timestamp.toISOString(),
        'payload', JSON.stringify(event.payload),
        'metadata', JSON.stringify(event.metadata)
      );

      // Also publish to pub/sub for real-time
      await this.redis.publish('events', JSON.stringify(event));

      logger.info(`Event published: ${event.type}`, { eventId: event.id });
    } catch (error) {
      logger.error('Failed to publish event:', error);
    }
  }

  subscribe(eventType: string, handler: (event: Event) => Promise<void>): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(handler);

    return () => {
      const handlers = this.subscribers.get(eventType) || [];
      this.subscribers.set(
        eventType,
        handlers.filter(h => h !== handler)
      );
    };
  }

  private async startConsumer(): Promise<void> {
    let lastId = '0';

    while (true) {
      try {
        const results = await this.redis.xread(
          'BLOCK',
          1000,
          'STREAMS',
          'events',
          lastId
        );

        if (results) {
          for (const result of results) {
            const [stream, entries] = result;
            for (const [id, fields] of entries) {
              const event: Event = {
                id: fields.find((f: any) => f[0] === 'id')[1],
                type: fields.find((f: any) => f[0] === 'type')[1],
                timestamp: new Date(fields.find((f: any) => f[0] === 'timestamp')[1]),
                payload: JSON.parse(fields.find((f: any) => f[0] === 'payload')[1]),
                metadata: JSON.parse(fields.find((f: any) => f[0] === 'metadata')[1]),
              };

              await this.processEvent(event);
              lastId = id;
            }
          }
        }
      } catch (error) {
        logger.error('Event consumer error:', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async processEvent(event: Event): Promise<void> {
    const handlers = this.subscribers.get(event.type) || [];
    
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        logger.error(`Handler failed for event ${event.type}:`, error);
        // Store failed event for retry
        await this.storeFailedEvent(event, error);
      }
    }
  }

  private async storeFailedEvent(event: Event, error: any): Promise<void> {
    await this.redis.xadd(
      'failed-events',
      '*',
      'event', JSON.stringify(event),
      'error', error.message,
      'timestamp', new Date().toISOString()
    );
  }

  async retryFailedEvents(): Promise<void> {
    const failedEvents = await this.redis.xrange('failed-events', '-', '+', 'COUNT', 100);

    for (const [id, fields] of failedEvents) {
      const eventData = fields.find((f: any) => f[0] === 'event')[1];
      const event = JSON.parse(eventData);

      try {
        await this.processEvent(event);
        await this.redis.xdel('failed-events', id);
      } catch (error) {
        logger.error(`Retry failed for event ${event.id}:`, error);
      }
    }
  }
                                                  }
