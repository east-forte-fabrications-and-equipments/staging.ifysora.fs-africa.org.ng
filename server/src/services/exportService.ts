import PDFDocument from 'pdfkit';
import { createObjectCsvStringifier } from 'csv-writer';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ExportOptions {
  includeMetadata?: boolean;
  includeConfidence?: boolean;
  includeBodyShape?: boolean;
  format: 'pdf' | 'csv' | 'json';
}

export class ExportService {
  private static instance: ExportService;
  private tempDir: string;
  
  private constructor() {
    this.tempDir = path.join(__dirname, '../../temp/exports');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }
  
  static getInstance(): ExportService {
    if (!ExportService.instance) {
      ExportService.instance = new ExportService();
    }
    return ExportService.instance;
  }
  
  async generateExport(
    measurementId: string,
    userId: string,
    options: ExportOptions
  ): Promise<{ url: string; filename: string; mimeType: string }> {
    try {
      // Fetch measurement with user data
      const measurement = await prisma.measurement.findFirst({
        where: {
          id: measurementId,
          userId,
        },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              phone: true,
            },
          },
        },
      });
      
      if (!measurement) {
        throw new Error('Measurement not found');
      }
      
      // Get measurements data
      const measurements = measurement.data as Record<string, number>;
      const confidenceScores = measurement.confidenceScores as Record<string, number>;
      
      let fileBuffer: Buffer;
      let mimeType: string;
      let extension: string;
      
      switch (options.format) {
        case 'pdf':
          fileBuffer = await this.generatePDF(measurement, measurements, confidenceScores, options);
          mimeType = 'application/pdf';
          extension = 'pdf';
          break;
        case 'csv':
          fileBuffer = await this.generateCSV(measurement, measurements, confidenceScores, options);
          mimeType = 'text/csv';
          extension = 'csv';
          break;
        case 'json':
          fileBuffer = await this.generateJSON(measurement, measurements, confidenceScores, options);
          mimeType = 'application/json';
          extension = 'json';
          break;
        default:
          throw new Error('Unsupported export format');
      }
      
      // Save to temporary file
      const filename = `ifysora-measurement-${measurement.sessionId}.${extension}`;
      const filePath = path.join(this.tempDir, filename);
      fs.writeFileSync(filePath, fileBuffer);
      
      // Generate download URL (signed, temporary)
      const url = `/api/exports/download/${measurement.sessionId}/${filename}`;
      
      return {
        url,
        filename,
        mimeType,
      };
      
    } catch (error) {
      logger.error('Export generation failed:', error);
      throw error;
    }
  }
  
  private async generatePDF(
    measurement: any,
    measurements: Record<string, number>,
    confidenceScores: Record<string, number>,
    options: ExportOptions
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];
        
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        
        // Header with logo
        doc.fontSize(24)
          .font('Helvetica-Bold')
          .text('iFYSORA', { align: 'center' })
          .fontSize(12)
          .font('Helvetica')
          .text('3D Anthropometric Measurement Report', { align: 'center' })
          .moveDown();
        
        // Ecosystem branding
        doc.fontSize(8)
          .font('Helvetica-Oblique')
          .text('Part of the FYSORA Ecosystem', { align: 'center' })
          .moveDown();
        
        doc.fontSize(10)
          .font('Helvetica')
          .text(`Session ID: ${measurement.sessionId}`)
          .text(`Date: ${new Date(measurement.timestamp).toLocaleString()}`)
          .text(`Subject: ${measurement.user.displayName}`)
          .text(`Email: ${measurement.user.email}`)
          .text(`Height: ${measurement.userHeightCm} cm`)
          .moveDown();
        
        // Body shape
        if (options.includeBodyShape && measurement.bodyShape) {
          doc.fontSize(14)
            .font('Helvetica-Bold')
            .text('Body Shape Analysis', { underline: true })
            .moveDown(0.5)
            .fontSize(12)
            .font('Helvetica')
            .text(`Classification: ${measurement.bodyShape}`);
          
          if (measurement.confidenceScores) {
            const avgConfidence = Object.values(confidenceScores).reduce((a: number, b: number) => a + b, 0) / 
                                 Object.keys(confidenceScores).length;
            doc.text(`Confidence Score: ${avgConfidence.toFixed(1)}%`);
          }
          doc.moveDown();
        }
        
        // Measurements table
        doc.fontSize(14)
          .font('Helvetica-Bold')
          .text('Anthropometric Measurements', { underline: true })
          .moveDown(0.5);
        
        // Table header
        const tableTop = doc.y;
        const col1 = 50;
        const col2 = 250;
        const col3 = 380;
        const col4 = 480;
        const rowHeight = 20;
        
        doc.fontSize(10)
          .font('Helvetica-Bold')
          .text('Measurement', col1, tableTop)
          .text('Value (cm)', col2, tableTop)
          .text('Confidence', col3, tableTop);
        
        if (options.includeMetadata) {
          doc.text('Status', col4, tableTop);
        }
        
        doc.moveDown(0.5);
        doc.lineWidth(0.5)
          .moveTo(50, doc.y)
          .lineTo(550, doc.y)
          .stroke();
        
        let row = 0;
        for (const [key, value] of Object.entries(measurements)) {
          if (key === 'Body shape') continue;
          
          const yPos = doc.y;
          doc.font('Helvetica')
            .fontSize(9)
            .text(key, col1, yPos, { width: 190 })
            .text(typeof value === 'number' ? value.toFixed(1) : String(value), col2, yPos)
            .text(confidenceScores[key] ? `${confidenceScores[key].toFixed(1)}%` : 'N/A', col3, yPos);
          
          if (options.includeMetadata) {
            const confidence = confidenceScores[key] || 0;
            const status = confidence > 80 ? 'High' : confidence > 60 ? 'Medium' : 'Low';
            doc.text(status, col4, yPos);
          }
          
          row++;
          if (row % 20 === 0) {
            doc.addPage();
            row = 0;
          }
        }
        
        // Footer
        doc.addPage();
        doc.fontSize(10)
          .font('Helvetica')
          .text('Generated by iFYSORA - Part of the FYSORA Ecosystem', { align: 'center' })
          .text('This report contains confidential anthropometric data.', { align: 'center' })
          .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
        
        doc.end();
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  private async generateCSV(
    measurement: any,
    measurements: Record<string, number>,
    confidenceScores: Record<string, number>,
    options: ExportOptions
  ): Promise<Buffer> {
    const records = [];
    
    // Header row
    const header = ['Measurement', 'Value (cm)'];
    if (options.includeConfidence) header.push('Confidence (%)');
    if (options.includeBodyShape) header.push('Body Shape');
    if (options.includeMetadata) {
      header.push('Session ID', 'Date', 'User', 'Height (cm)');
    }
    
    // Data rows
    for (const [key, value] of Object.entries(measurements)) {
      if (key === 'Body shape') continue;
      
      const row: any = {
        'Measurement': key,
        'Value (cm)': typeof value === 'number' ? value.toFixed(1) : value,
      };
      
      if (options.includeConfidence) {
        row['Confidence (%)'] = confidenceScores[key] ? confidenceScores[key].toFixed(1) : 'N/A';
      }
      
      if (options.includeBodyShape && key === 'Body shape') {
        row['Body Shape'] = measurement.bodyShape || 'N/A';
      }
      
      if (options.includeMetadata) {
        row['Session ID'] = measurement.sessionId;
        row['Date'] = new Date(measurement.timestamp).toLocaleString();
        row['User'] = measurement.user.displayName;
        row['Height (cm)'] = measurement.userHeightCm;
      }
      
      records.push(row);
    }
    
    // Add body shape as separate entry if included
    if (options.includeBodyShape && measurement.bodyShape) {
      records.push({
        'Measurement': 'Body Shape',
        'Value (cm)': measurement.bodyShape,
      });
    }
    
    const csvStringifier = createObjectCsvStringifier({
      header: header.map(h => ({ id: h, title: h })),
    });
    
    const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
    return Buffer.from(csvContent, 'utf-8');
  }
  
  private async generateJSON(
    measurement: any,
    measurements: Record<string, number>,
    confidenceScores: Record<string, number>,
    options: ExportOptions
  ): Promise<Buffer> {
    const data: any = {
      sessionId: measurement.sessionId,
      timestamp: measurement.timestamp,
      user: {
        id: measurement.user.id,
        displayName: measurement.user.displayName,
        email: measurement.user.email,
        phone: measurement.user.phone,
      },
      height: measurement.userHeightCm,
    };
    
    if (options.includeBodyShape) {
      data.bodyShape = measurement.bodyShape;
    }
    
    data.measurements = measurements;
    
    if (options.includeConfidence) {
      data.confidenceScores = confidenceScores;
      data.averageConfidence = Object.values(confidenceScores).reduce((a: number, b: number) => a + b, 0) / 
                               Object.keys(confidenceScores).length;
    }
    
    if (options.includeMetadata) {
      data.metadata = {
        aiModel: measurement.aiModelUsed,
        calibrationData: measurement.calibrationData,
        poseFeedback: measurement.poseFeedback,
        clothingFeedback: measurement.clothingFeedback,
      };
    }
    
    return Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
  }
  
  async cleanupTempFiles(): Promise<void> {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        // Delete files older than 1 hour
        if (now - stats.mtimeMs > 3600000) {
          fs.unlinkSync(filePath);
          logger.info(`Cleaned up old export file: ${file}`);
        }
      }
    } catch (error) {
      logger.error('Failed to clean up temp files:', error);
    }
  }
  }
