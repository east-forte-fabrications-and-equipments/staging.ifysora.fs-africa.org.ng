import prometheus from 'prom-client';
import { logger } from '../../utils/logger.js';

export class Metrics {
  private static instance: Metrics;
  private registry: prometheus.Registry;

  // Metrics
  private httpRequestDuration: prometheus.Histogram;
  private activeUsers: prometheus.Gauge;
  private measurementsCreated: prometheus.Counter;
  private measurementErrors: prometheus.Counter;
  private aiProcessingTime: prometheus.Histogram;
  private databaseQueryTime: prometheus.Histogram;
  private cacheHitRate: prometheus.Counter;
  private cacheMissRate: prometheus.Counter;

  private constructor() {
    this.registry = new prometheus.Registry();
    this.setupMetrics();
    this.setupDefaultMetrics();
  }

  static getInstance(): Metrics {
    if (!Metrics.instance) {
      Metrics.instance = new Metrics();
    }
    return Metrics.instance;
  }

  private setupMetrics(): void {
    // HTTP request duration
    this.httpRequestDuration = new prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 1, 3, 5, 10],
    });
    this.registry.registerMetric(this.httpRequestDuration);

    // Active users
    this.activeUsers = new prometheus.Gauge({
      name: 'active_users',
      help: 'Number of active users',
    });
    this.registry.registerMetric(this.activeUsers);

    // Measurements created
    this.measurementsCreated = new prometheus.Counter({
      name: 'measurements_created_total',
      help: 'Total number of measurements created',
      labelNames: ['status'],
    });
    this.registry.registerMetric(this.measurementsCreated);

    // Measurement errors
    this.measurementErrors = new prometheus.Counter({
      name: 'measurement_errors_total',
      help: 'Total number of measurement errors',
      labelNames: ['type'],
    });
    this.registry.registerMetric(this.measurementErrors);

    // AI processing time
    this.aiProcessingTime = new prometheus.Histogram({
      name: 'ai_processing_seconds',
      help: 'AI processing time in seconds',
      buckets: [1, 3, 5, 10, 20, 30],
    });
    this.registry.registerMetric(this.aiProcessingTime);

    // Database query time
    this.databaseQueryTime = new prometheus.Histogram({
      name: 'database_query_seconds',
      help: 'Database query time in seconds',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1],
    });
    this.registry.registerMetric(this.databaseQueryTime);

    // Cache metrics
    this.cacheHitRate = new prometheus.Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
    });
    this.registry.registerMetric(this.cacheHitRate);

    this.cacheMissRate = new prometheus.Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
    });
    this.registry.registerMetric(this.cacheMissRate);
  }

  private setupDefaultMetrics(): void {
    prometheus.collectDefaultMetrics({
      register: this.registry,
      prefix: 'ifysora_',
    });
  }

  // Recording methods
  recordHttpRequest(method: string, route: string, status: number, duration: number): void {
    this.httpRequestDuration.observe(
      { method, route, status_code: status },
      duration
    );
  }

  incrementActiveUsers(count: number = 1): void {
    this.activeUsers.inc(count);
  }

  decrementActiveUsers(count: number = 1): void {
    this.activeUsers.dec(count);
  }

  recordMeasurementCreated(status: 'success' | 'failed'): void {
    this.measurementsCreated.inc({ status });
  }

  recordMeasurementError(type: string): void {
    this.measurementErrors.inc({ type });
  }

  recordAIProcessingTime(seconds: number): void {
    this.aiProcessingTime.observe(seconds);
  }

  recordDatabaseQuery(operation: string, duration: number): void {
    this.databaseQueryTime.observe({ operation }, duration);
  }

  recordCacheHit(): void {
    this.cacheHitRate.inc();
  }

  recordCacheMiss(): void {
    this.cacheMissRate.inc();
  }

  getMetrics(): string {
    return this.registry.metrics();
  }

  async getMetricsAsync(): Promise<string> {
    return this.registry.metrics();
  }
}

// Middleware for tracking HTTP requests
export function metricsMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  const metrics = Metrics.getInstance();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    metrics.recordHttpRequest(
      req.method,
      req.route?.path || req.path,
      res.statusCode,
      duration
    );
  });

  next();
      }
