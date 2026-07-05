import { Request, Response } from 'express';
import { ExportService } from '../services/exportService.js';
import { WhatsAppService } from '../services/whatsappService.js';
import { CloudBackupService } from '../services/cloudBackupService.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';

export class ExportController {
  private exportService: ExportService;
  private whatsappService: WhatsAppService;
  private cloudBackupService: CloudBackupService;
  private tempDir: string;
  
  constructor() {
    this.exportService = ExportService.getInstance();
    this.whatsappService = WhatsAppService.getInstance();
    this.cloudBackupService = CloudBackupService.getInstance();
    this.tempDir = path.join(process.cwd(), 'temp/exports');
  }
  
  async exportMeasurement(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { format = 'pdf' } = req.query;
      const userId = (req as any).user.id;
      
      const result = await this.exportService.generateExport(id, userId, {
        format: format as 'pdf' | 'csv' | 'json',
        includeMetadata: true,
        includeConfidence: true,
        includeBodyShape: true,
      });
      
      return res.json({
        success: true,
        downloadUrl: result.url,
        filename: result.filename,
        mimeType: result.mimeType,
      });
      
    } catch (error) {
      logger.error('Export error:', error);
      return res.status(500).json({
        error: 'Export failed',
        details: error.message,
      });
    }
  }
  
  async downloadExport(req: Request, res: Response) {
    try {
      const { sessionId, filename } = req.params;
      const filePath = path.join(this.tempDir, filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found or expired' });
      }
      
      // Determine mime type
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.csv': 'text/csv',
        '.json': 'application/json',
      };
      
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      
    } catch (error) {
      logger.error('Download error:', error);
      return res.status(500).json({
        error: 'Download failed',
        details: error.message,
      });
    }
  }
  
  async whatsappShare(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { phoneNumber, message } = req.body;
      const userId = (req as any).user.id;
      
      const shareResult = await this.whatsappService.generateShareLink({
        measurementId: id,
        userId,
        phoneNumber,
        message,
      });
      
      return res.json({
        success: true,
        whatsappUrl: shareResult.whatsappUrl,
        pdfUrl: shareResult.pdfUrl,
        shareUrl: shareResult.shareUrl,
      });
      
    } catch (error) {
      logger.error('WhatsApp share error:', error);
      return res.status(500).json({
        error: 'WhatsApp sharing failed',
        details: error.message,
      });
    }
  }
  
  async backupMeasurement(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { provider, accessToken } = req.body;
      const userId = (req as any).user.id;
      
      const result = await this.cloudBackupService.backupMeasurement(
        id,
        userId,
        {
          type: provider,
          accessToken,
          userId,
        }
      );
      
      return res.json({
        success: true,
        ...result,
      });
      
    } catch (error) {
      logger.error('Cloud backup error:', error);
      return res.status(500).json({
        error: 'Cloud backup failed',
        details: error.message,
      });
    }
  }
  
  async getCloudProviders(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      
      // Get user's connected cloud providers
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          cloudProviders: true,
        },
      });
      
      return res.json({
        providers: user?.cloudProviders || [],
      });
      
    } catch (error) {
      logger.error('Get cloud providers error:', error);
      return res.status(500).json({
        error: 'Failed to fetch cloud providers',
        details: error.message,
      });
    }
  }
  
  async connectCloudProvider(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { provider, accessToken, refreshToken } = req.body;
      
      // Store provider credentials (encrypted in production)
      await prisma.user.update({
        where: { id: userId },
        data: {
          cloudProviders: {
            push: {
              type: provider,
              accessToken,
              refreshToken,
              connectedAt: new Date(),
            },
          },
        },
      });
      
      return res.json({
        success: true,
        message: `Connected to ${provider}`,
      });
      
    } catch (error) {
      logger.error('Connect cloud provider error:', error);
      return res.status(500).json({
        error: 'Failed to connect cloud provider',
        details: error.message,
      });
    }
  }
}
