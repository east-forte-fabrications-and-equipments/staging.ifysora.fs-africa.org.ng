import { MeasurementService } from './MeasurementService.js';
import { prisma } from '../../config/database.js';
import { EventBus } from '../../infrastructure/events/EventBus.js';
import { logger } from '../../utils/logger.js';

export class BatchMeasurementService {
  private measurementService: MeasurementService;
  private eventBus: EventBus;

  constructor() {
    this.measurementService = new MeasurementService();
    this.eventBus = EventBus.getInstance();
  }

  async analyzeBatch(measurements: any[], userId: string): Promise<{
    successful: any[];
    failed: Array<{ index: number; error: string }>;
    summary: {
      total: number;
      success: number;
      failed: number;
    };
  }> {
    const results: any[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    // Process in batches of 10 to avoid overwhelming Gemini
    const batchSize = 10;
    for (let i = 0; i < measurements.length; i += batchSize) {
      const batch = measurements.slice(i, i + batchSize);
      
      const promises = batch.map(async (measurement, index) => {
        try {
          const result = await this.measurementService.analyze(measurement, userId);
          return { index: i + index, result };
        } catch (error) {
          return { index: i + index, error: error.message };
        }
      });

      const batchResults = await Promise.all(promises);
      
      for (const result of batchResults) {
        if ('result' in result) {
          results.push(result.result);
        } else {
          errors.push(result);
        }
      }

      // Publish progress event
      await this.eventBus.publish({
        id: crypto.randomUUID(),
        type: 'batch.progress',
        timestamp: new Date(),
        payload: {
          processed: i + batch.length,
          total: measurements.length,
          successful: results.length,
          failed: errors.length,
        },
        metadata: {
          userId,
          correlationId: global.correlationId || 'unknown',
          source: 'ifysora',
        },
      });
    }

    return {
      successful: results,
      failed: errors,
      summary: {
        total: measurements.length,
        success: results.length,
        failed: errors.length,
      },
    };
  }

  async exportBatch(measurementIds: string[], userId: string): Promise<Buffer> {
    const measurements = await prisma.measurement.findMany({
      where: {
        id: { in: measurementIds },
        userId,
      },
      include: {
        portrait: {
          select: {
            clientName: true,
            clientEmail: true,
          },
        },
      },
    });

    // Generate combined report
    const report = {
      exportedAt: new Date().toISOString(),
      total: measurements.length,
      measurements: measurements.map(m => ({
        sessionId: m.sessionId,
        timestamp: m.timestamp,
        clientName: m.portrait?.clientName || m.clientName || 'Unknown',
        bodyShape: m.bodyShape,
        measurements: m.data,
        confidenceScores: m.confidenceScores,
      })),
    };

    return Buffer.from(JSON.stringify(report, null, 2), 'utf-8');
  }

  async deleteBatch(measurementIds: string[], userId: string): Promise<{
    deleted: number;
    failed: Array<{ id: string; error: string }>;
  }> {
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const id of measurementIds) {
      try {
        await prisma.measurement.delete({
          where: {
            id,
            userId,
          },
        });
        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }

    const successful = results.filter(r => r.success);
    const failed = results
      .filter(r => !r.success)
      .map(r => ({ id: r.id, error: r.error || 'Unknown error' }));

    return {
      deleted: successful.length,
      failed,
    };
  }
}
