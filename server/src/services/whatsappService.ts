import { ExportService } from './exportService.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../config/database.js';

export interface WhatsAppShareOptions {
  measurementId: string;
  userId: string;
  phoneNumber?: string;
  message?: string;
}

export class WhatsAppService {
  private static instance: WhatsAppService;
  private exportService: ExportService;
  private baseUrl: string;
  
  private constructor() {
    this.exportService = ExportService.getInstance();
    this.baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  }
  
  static getInstance(): WhatsAppService {
    if (!WhatsAppService.instance) {
      WhatsAppService.instance = new WhatsAppService();
    }
    return WhatsAppService.instance;
  }
  
  async generateShareLink(options: WhatsAppShareOptions): Promise<{ shareUrl: string; pdfUrl: string }> {
    try {
      // Generate PDF export
      const pdfExport = await this.exportService.generateExport(
        options.measurementId,
        options.userId,
        {
          format: 'pdf',
          includeMetadata: true,
          includeConfidence: true,
          includeBodyShape: true,
        }
      );
      
      // Create share token (signed, temporary)
      const shareToken = this.generateShareToken(options.measurementId);
      
      // Store share record
      await prisma.measurement.update({
        where: { id: options.measurementId },
        data: {
          metadata: {
            shareToken,
            shareCreatedAt: new Date().toISOString(),
            shareExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          },
        },
      });
      
      const pdfUrl = `${this.baseUrl}${pdfExport.url}`;
      const shareUrl = `${this.baseUrl}/share/${shareToken}`;
      
      // WhatsApp share URL
      const message = options.message || 
        `📏 iFYSORA Measurement Report\n\n` +
        `Session: ${options.measurementId}\n` +
        `Generated: ${new Date().toLocaleString()}\n\n` +
        `📄 Download full report: ${pdfUrl}\n` +
        `🔗 Share link: ${shareUrl}\n\n` +
        `Part of the FYSORA Ecosystem`;

      let whatsappUrl;
      if (options.phoneNumber) {
        whatsappUrl = `https://wa.me/${options.phoneNumber}?text=${encodeURIComponent(message)}`;
      } else {
        whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      }
      
      return {
        shareUrl,
        pdfUrl,
        whatsappUrl,
      };
      
    } catch (error) {
      logger.error('WhatsApp share link generation failed:', error);
      throw error;
    }
  }
  
  private generateShareToken(measurementId: string): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(`${measurementId}-${Date.now()}-${process.env.JWT_SECRET}`);
    return hash.digest('hex').substring(0, 32);
  }
  
  async validateShareToken(token: string): Promise<{ valid: boolean; measurementId?: string }> {
    try {
      const measurement = await prisma.measurement.findFirst({
        where: {
          metadata: {
            path: ['shareToken'],
            equals: token,
          },
        },
      });
      
      if (!measurement) {
        return { valid: false };
      }
      
      const expiresAt = measurement.metadata?.shareExpiresAt;
      if (expiresAt && new Date(expiresAt) < new Date()) {
        return { valid: false };
      }
      
      return { valid: true, measurementId: measurement.id };
      
    } catch (error) {
      logger.error('Share token validation failed:', error);
      return { valid: false };
    }
  }
        }
