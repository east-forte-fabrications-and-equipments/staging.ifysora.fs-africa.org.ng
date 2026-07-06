import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '../config/database.js';
import { storageService } from './storageService.js';
import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

export interface PortraitOptions {
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientNotes?: string;
  setAsActive?: boolean;
}

export interface PortraitUploadResult {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  isVerified: boolean;
  faceDetected: boolean;
}

export class PortraitService {
  private static instance: PortraitService;
  
  private constructor() {}
  
  static getInstance(): PortraitService {
    if (!PortraitService.instance) {
      PortraitService.instance = new PortraitService();
    }
    return PortraitService.instance;
  }
  
  async uploadPortrait(
    userId: string,
    imageData: string | Buffer,
    uploadMethod: 'CAMERA' | 'UPLOAD' | 'URL' | 'DRAG_DROP',
    options: PortraitOptions = {}
  ): Promise<PortraitUploadResult> {
    try {
      // Validate user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Upload to Cloudinary
      const uploadResult = await this.uploadToCloudinary(imageData, userId);
      
      // Perform face detection
      const faceDetection = await this.detectFace(uploadResult.url);
      
      // Create portrait record
      const portrait = await prisma.clientPortrait.create({
        data: {
          userId,
          imageUrl: uploadResult.url,
          publicId: uploadResult.publicId,
          thumbnailUrl: uploadResult.thumbnailUrl,
          isActive: options.setAsActive || false,
          isVerified: faceDetection.faceDetected && faceDetection.confidence > 0.7,
          faceDetected: faceDetection.faceDetected,
          faceConfidence: faceDetection.confidence,
          clientName: options.clientName,
          clientEmail: options.clientEmail,
          clientPhone: options.clientPhone,
          clientNotes: options.clientNotes,
          uploadMethod,
          metadata: {
            uploadTimestamp: new Date().toISOString(),
            ...options,
          },
        },
      });
      
      // If set as active, update user's active portrait
      if (options.setAsActive) {
        await this.setActivePortrait(userId, portrait.id);
      }
      
      // Audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'PORTRAIT_UPLOADED',
          resource: 'clientPortrait',
          resourceId: portrait.id,
          newValues: {
            uploadMethod,
            faceDetected: faceDetection.faceDetected,
            isVerified: portrait.isVerified,
          },
          source: 'ifysora',
        },
      });
      
      logger.info(`Portrait uploaded for user ${userId}: ${portrait.id}`);
      
      return {
        id: portrait.id,
        imageUrl: portrait.imageUrl,
        thumbnailUrl: portrait.thumbnailUrl || portrait.imageUrl,
        isVerified: portrait.isVerified,
        faceDetected: portrait.faceDetected,
      };
      
    } catch (error) {
      logger.error('Portrait upload failed:', error);
      throw new Error(`Failed to upload portrait: ${error.message}`);
    }
  }
  
  private async uploadToCloudinary(
    imageData: string | Buffer,
    userId: string
  ): Promise<{ url: string; publicId: string; thumbnailUrl: string }> {
    try {
      const folder = `ifysora/users/${userId}/portraits`;
      
      let result;
      if (typeof imageData === 'string' && imageData.startsWith('data:image')) {
        // Base64 image
        result = await cloudinary.uploader.upload(imageData, {
          folder,
          transformation: [
            { quality: 'auto:best' },
            { fetch_format: 'auto' },
            { width: 800, crop: 'limit' },
          ],
        });
      } else if (typeof imageData === 'string' && imageData.startsWith('http')) {
        // URL
        result = await cloudinary.uploader.upload(imageData, {
          folder,
          transformation: [
            { quality: 'auto:best' },
            { fetch_format: 'auto' },
            { width: 800, crop: 'limit' },
          ],
        });
      } else {
        // Buffer
        result = await cloudinary.uploader.upload(
          `data:image/jpeg;base64,${imageData.toString('base64')}`,
          {
            folder,
            transformation: [
              { quality: 'auto:best' },
              { fetch_format: 'auto' },
              { width: 800, crop: 'limit' },
            ],
          }
        );
      }
      
      // Generate thumbnail
      const thumbnail = cloudinary.url(result.public_id, {
        transformation: [
          { width: 200, height: 200, crop: 'fill', gravity: 'face' },
          { quality: 'auto' },
        ],
      });
      
      return {
        url: result.secure_url,
        publicId: result.public_id,
        thumbnailUrl: thumbnail,
      };
      
    } catch (error) {
      logger.error('Cloudinary upload failed:', error);
      throw new Error('Image upload failed');
    }
  }
  
  private async detectFace(imageUrl: string): Promise<{ faceDetected: boolean; confidence: number }> {
    try {
      // Use Cloudinary's face detection
      const detection = await cloudinary.api.resource(
        imageUrl.split('/').pop()?.split('.')[0] || '',
        {
          detection: 'face',
        }
      );
      
      const faces = detection.detection?.face?.faces || [];
      if (faces.length > 0) {
        const confidence = faces[0].confidence || 0;
        return {
          faceDetected: true,
          confidence: confidence / 100, // Normalize to 0-1
        };
      }
      
      return {
        faceDetected: false,
        confidence: 0,
      };
      
    } catch (error) {
      logger.warn('Face detection failed:', error);
      return {
        faceDetected: false,
        confidence: 0,
      };
    }
  }
  
  async setActivePortrait(userId: string, portraitId: string): Promise<void> {
    try {
      // Deactivate all other portraits
      await prisma.clientPortrait.updateMany({
        where: {
          userId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });
      
      // Activate the selected portrait
      await prisma.clientPortrait.update({
        where: { id: portraitId },
        data: {
          isActive: true,
        },
      });
      
      // Update user's active portrait reference
      await prisma.user.update({
        where: { id: userId },
        data: {
          activePortraitId: portraitId,
        },
      });
      
      logger.info(`Active portrait set to ${portraitId} for user ${userId}`);
      
    } catch (error) {
      logger.error('Failed to set active portrait:', error);
      throw new Error('Failed to set active portrait');
    }
  }
  
  async getPortrait(portraitId: string): Promise<any> {
    try {
      const portrait = await prisma.clientPortrait.findUnique({
        where: { id: portraitId },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
          measurements: {
            take: 5,
            orderBy: { timestamp: 'desc' },
            select: {
              id: true,
              sessionId: true,
              timestamp: true,
              bodyShape: true,
            },
          },
        },
      });
      
      if (!portrait) {
        throw new Error('Portrait not found');
      }
      
      return portrait;
      
    } catch (error) {
      logger.error('Failed to get portrait:', error);
      throw new Error('Failed to retrieve portrait');
    }
  }
  
  async getClientPortraits(userId: string): Promise<any[]> {
    try {
      const portraits = await prisma.clientPortrait.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          measurements: {
            take: 3,
            orderBy: { timestamp: 'desc' },
            select: {
              id: true,
              sessionId: true,
              timestamp: true,
              bodyShape: true,
            },
          },
        },
      });
      
      return portraits;
      
    } catch (error) {
      logger.error('Failed to get client portraits:', error);
      throw new Error('Failed to retrieve portraits');
    }
  }
  
  async deletePortrait(userId: string, portraitId: string): Promise<void> {
    try {
      const portrait = await prisma.clientPortrait.findFirst({
        where: {
          id: portraitId,
          userId,
        },
      });
      
      if (!portrait) {
        throw new Error('Portrait not found');
      }
      
      // Check if this is the active portrait
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { activePortraitId: true },
      });
      
      // Delete from Cloudinary
      try {
        await cloudinary.uploader.destroy(portrait.publicId);
      } catch (cloudinaryError) {
        logger.warn('Failed to delete portrait from Cloudinary:', cloudinaryError);
      }
      
      // Delete from database
      await prisma.clientPortrait.delete({
        where: { id: portraitId },
      });
      
      // If this was the active portrait, clear the reference
      if (user?.activePortraitId === portraitId) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            activePortraitId: null,
          },
        });
      }
      
      // Audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'PORTRAIT_DELETED',
          resource: 'clientPortrait',
          resourceId: portraitId,
          source: 'ifysora',
        },
      });
      
      logger.info(`Portrait ${portraitId} deleted for user ${userId}`);
      
    } catch (error) {
      logger.error('Failed to delete portrait:', error);
      throw new Error('Failed to delete portrait');
    }
  }
  
  async associateWithMeasurement(
    portraitId: string,
    measurementId: string
  ): Promise<void> {
    try {
      await prisma.measurement.update({
        where: { id: measurementId },
        data: {
          portraitId,
          clientName: undefined, // Will be set from portrait
          clientEmail: undefined,
        },
      });
      
      logger.info(`Measurement ${measurementId} associated with portrait ${portraitId}`);
      
    } catch (error) {
      logger.error('Failed to associate measurement with portrait:', error);
      throw new Error('Failed to associate measurement');
    }
  }
              }
