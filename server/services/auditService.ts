import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

export interface AuditLogEntry {
  userId?: string;
  organizationId?: string;
  measurementId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
  source: 'ifysora' | 'fysora-fashn' | 'admin';
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  private static instance: AuditService;
  
  private constructor() {}
  
  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }
  
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      // Sanitize sensitive data
      const sanitizedNewValues = this.sanitizeSensitiveData(entry.newValues);
      const sanitizedOldValues = this.sanitizeSensitiveData(entry.oldValues);
      
      await prisma.auditLog.create({
        data: {
          userId: entry.userId,
          organizationId: entry.organizationId,
          measurementId: entry.measurementId,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          oldValues: sanitizedOldValues,
          newValues: sanitizedNewValues,
          metadata: entry.metadata,
          source: entry.source,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
      
      // Also log to Winston for important events
      if (['USER_REGISTERED', 'USER_LOGIN', 'MEASUREMENT_CREATED', 'PAYMENT_PROCESSED'].includes(entry.action)) {
        logger.info('Audit event:', {
          action: entry.action,
          userId: entry.userId,
          resource: entry.resource,
          resourceId: entry.resourceId,
        });
      }
      
    } catch (error) {
      logger.error('Failed to write audit log:', error);
      // Don't throw - audit logging should not break the main flow
    }
  }
  
  private sanitizeSensitiveData(data: any): any {
    if (!data) return data;
    
    const sensitiveFields = ['password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 'apiKey', 'secret'];
    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }
    
    return sanitized;
  }
  
  async getAuditLogs(params: {
    userId?: string;
    organizationId?: string;
    action?: string;
    resource?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: any[]; total: number }> {
    try {
      const where: any = {};
      
      if (params.userId) where.userId = params.userId;
      if (params.organizationId) where.organizationId = params.organizationId;
      if (params.action) where.action = params.action;
      if (params.resource) where.resource = params.resource;
      if (params.from || params.to) {
        where.timestamp = {};
        if (params.from) where.timestamp.gte = params.from;
        if (params.to) where.timestamp.lte = params.to;
      }
      
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: params.limit || 50,
          skip: params.offset || 0,
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                email: true,
              },
            },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);
      
      return { logs, total };
      
    } catch (error) {
      logger.error('Failed to fetch audit logs:', error);
      throw error;
    }
  }
  }
