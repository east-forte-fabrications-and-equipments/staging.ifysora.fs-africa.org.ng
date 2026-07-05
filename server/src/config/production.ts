import { env } from './env.js';

export const productionConfig = {
    // SSL/HTTPS
    ssl: {
        enabled: true,
        key: process.env.SSL_KEY_PATH,
        cert: process.env.SSL_CERT_PATH,
    },
    
    // Database connection pool
    database: {
        pool: {
            min: 2,
            max: 10,
            idle: 10000,
        },
        timeout: 30000,
    },
    
    // Redis
    redis: {
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 3,
    },
    
    // CORS - strict for production
    cors: {
        origin: env.ALLOWED_ORIGINS,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        maxAge: 86400,
    },
    
    // Rate limiting - stricter in production
    rateLimit: {
        windowMs: 60000,
        max: 50,
        message: 'Too many requests, please try again later.',
        standardHeaders: true,
        legacyHeaders: false,
    },
};
