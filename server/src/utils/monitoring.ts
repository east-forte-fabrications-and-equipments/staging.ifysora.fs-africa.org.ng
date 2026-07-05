import { createLogger, format, transports } from 'winston';
import Sentry from '@sentry/node';

// Initialize Sentry for error tracking
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
});

// Enhanced logger with structured logging
export const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
    ),
    defaultMeta: { service: 'ifysora' },
    transports: [
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.File({ filename: 'combined.log' }),
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.simple()
            )
        })
    ],
});

// Metrics tracking
import Prometheus from 'prom-client';

const httpRequestCounter = new Prometheus.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
});

const measurementCounter = new Prometheus.Counter({
    name: 'measurements_total',
    help: 'Total number of measurements created',
    labelNames: ['status'],
});

export const metrics = {
    httpRequest: httpRequestCounter,
    measurement: measurementCounter,
};

// Middleware to track metrics
export const trackMetrics = (req: any, res: any, next: any) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        httpRequestCounter.inc({
            method: req.method,
            route: req.route?.path || req.path,
            status_code: res.statusCode,
        });
        // Track duration in a histogram
        logger.debug('Request completed', {
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration,
            ip: req.ip,
        });
    });
    next();
};
