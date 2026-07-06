import { prisma } from '../../config/database.js';
import { GeminiService } from '../../services/geminiService.js';
import { SyncService } from '../../services/syncService.js';
import { AuditService } from '../../services/auditService.js';
import { storageService } from '../../services/storageService.js';
import { logger } from '../../utils/logger.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Validation Schemas
export const MeasurementSchema = z.object({
  frontImage: z.string().regex(/^data:image\/(png|jpeg|jpg);base64,/),
  sideImage: z.string().regex(/^data:image\/(png|jpeg|jpg);base64,/),
  userHeightCm: z.number().min(50).max(300),
  useDepthSensor: z.boolean().optional(),
  portraitId: z.string().uuid().optional(),
  clientName: z.string().min(2).max(100).optional(),
  clientEmail: z.string().email().optional(),
});

export interface AnalysisResult {
  measurementId: string;
  sessionId: string;
  timestamp: Date;
  bodyShape: string;
  measurements: Record<string, number>;
  confidenceScores: Record<string, number>;
  calibrationData: any;
  poseFeedback: any;
  clothingFeedback: any;
  client?: {
    name: string;
    email: string;
    portraitId: string;
  };
  images: {
    front: string;
    side: string;
  };
}

export class MeasurementService {
  private geminiService: GeminiService;
  private syncService: SyncService;
  private auditService: AuditService;

  constructor() {
    this.geminiService = GeminiService.getInstance();
    this.syncService = new SyncService();
    this.auditService = AuditService.getInstance();
  }

  async analyze(params: z.infer<typeof MeasurementSchema>, userId: string): Promise<AnalysisResult> {
    // Validate input
    const validated = MeasurementSchema.parse(params);
    
    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check subscription
    await this.checkSubscription(userId);

    // Process images
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const imageUrls = await this.uploadImages(validated.frontImage, validated.sideImage, userId, sessionId);

    // Get portrait info
    const portraitInfo = await this.getPortraitInfo(validated.portraitId, userId);

    // Analyze with AI
    const analysis = await this.geminiService.analyzeMeasurements(
      validated.frontImage,
      validated.sideImage,
      validated.userHeightCm,
      validated.useDepthSensor || false
    );

    // Save measurement
    const measurement = await this.saveMeasurement({
      userId,
      sessionId,
      analysis,
      validated,
      portraitInfo,
      imageUrls,
    });

    // Sync with FYSORA FASHN
    await this.syncMeasurement(measurement, user);

    // Audit log
    await this.auditService.log({
      userId,
      action: 'MEASUREMENT_CREATED',
      resource: 'measurement',
      resourceId: measurement.id,
      newValues: {
        measurementId: measurement.id,
        sessionId,
        portraitId: validated.portraitId || null,
        clientName: portraitInfo?.clientName || null,
      },
      source: 'ifysora',
    });

    return this.formatResult(measurement, imageUrls, portraitInfo);
  }

  private async checkSubscription(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true, verificationLevel: true },
    });

    if (user?.subscriptionStatus !== 'ACTIVE' && (user?.verificationLevel || 0) < 2) {
      const monthlyCount = await prisma.measurement.count({
        where: {
          userId,
          timestamp: {
            gte: new Date(new Date().setMonth(new Date().getMonth() - 1)),
          },
        },
      });

      if (monthlyCount >= 5) {
        throw new Error('Monthly measurement limit reached. Please subscribe to continue.');
      }
    }
  }

  private async uploadImages(
    frontImage: string,
    sideImage: string,
    userId: string,
    sessionId: string
  ): Promise<{ front: string | null; side: string | null }> {
    try {
      const [frontUpload, sideUpload] = await Promise.all([
        storageService.uploadImage(frontImage, userId, sessionId, 'front'),
        storageService.uploadImage(sideImage, userId, sessionId, 'side'),
      ]);

      return {
        front: frontUpload.url,
        side: sideUpload.url,
      };
    } catch (error) {
      logger.error('Image upload failed:', error);
      return { front: null, side: null };
    }
  }

  private async getPortraitInfo(portraitId: string | undefined, userId: string) {
    if (!portraitId) return null;

    const portrait = await prisma.clientPortrait.findFirst({
      where: {
        id: portraitId,
        userId,
      },
      select: {
        id: true,
        clientName: true,
        clientEmail: true,
        isVerified: true,
      },
    });

    return portrait;
  }

  private async saveMeasurement(data: {
    userId: string;
    sessionId: string;
    analysis: any;
    validated: z.infer<typeof MeasurementSchema>;
    portraitInfo: any;
    imageUrls: { front: string | null; side: string | null };
  }) {
    const { userId, sessionId, analysis, validated, portraitInfo, imageUrls } = data;

    return prisma.measurement.create({
      data: {
        userId,
        data: analysis.measurements,
        sessionId,
        timestamp: new Date(),
        userHeightCm: validated.userHeightCm,
        bodyShape: analysis.bodyShape,
        confidenceScores: analysis.confidenceScores,
        calibrationData: {
          ...analysis.calibrationData,
          frontImageUrl: imageUrls.front,
          sideImageUrl: imageUrls.side,
        },
        poseFeedback: analysis.poseFeedback,
        clothingFeedback: analysis.clothingFeedback,
        aiModelUsed: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
        aiConfidence: Object.values(analysis.confidenceScores).reduce((a, b) => a + b, 0) /
          Object.keys(analysis.confidenceScores).length,
        portraitId: portraitInfo?.id || undefined,
        clientName: validated.clientName || portraitInfo?.clientName || null,
        clientEmail: validated.clientEmail || portraitInfo?.clientEmail || null,
      },
    });
  }

  private async syncMeasurement(measurement: any, user: any) {
    try {
      const synced = await this.syncService.syncMeasurement(user, measurement);
      await prisma.measurement.update({
        where: { id: measurement.id },
        data: {
          syncedToFysora: true,
          fysoraMeasurementId: synced.id,
          syncedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to sync measurement:', error);
      // Don't throw - measurement is saved, sync can be retried later
    }
  }

  private formatResult(measurement: any, imageUrls: any, portraitInfo: any): AnalysisResult {
    return {
      measurementId: measurement.id,
      sessionId: measurement.sessionId,
      timestamp: measurement.timestamp,
      bodyShape: measurement.bodyShape,
      measurements: measurement.data,
      confidenceScores: measurement.confidenceScores,
      calibrationData: measurement.calibrationData,
      poseFeedback: measurement.poseFeedback,
      clothingFeedback: measurement.clothingFeedback,
      client: portraitInfo ? {
        name: portraitInfo.clientName,
        email: portraitInfo.clientEmail,
        portraitId: portraitInfo.id,
      } : undefined,
      images: {
        front: imageUrls.front,
        side: imageUrls.side,
      },
    };
  }
      }
