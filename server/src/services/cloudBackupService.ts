import axios from 'axios';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { ExportService } from './exportService.js';
import { encrypt, decrypt, maskToken } from '../utils/encryption.js';

export interface BackupProvider {
  type: 'google_drive' | 'dropbox' | 'onedrive';
  accessToken: string;
  refreshToken?: string;
  userId: string;
}

export class CloudBackupService {
  private static instance: CloudBackupService;
  private exportService: ExportService;
  
  private constructor() {
    this.exportService = ExportService.getInstance();
  }
  
  static getInstance(): CloudBackupService {
    if (!CloudBackupService.instance) {
      CloudBackupService.instance = new CloudBackupService();
    }
    return CloudBackupService.instance;
  }
  
  async connectProvider(
    userId: string,
    provider: 'google_drive' | 'dropbox' | 'onedrive',
    accessToken: string,
    refreshToken?: string
  ): Promise<void> {
    try {
      // Encrypt tokens before storing
      const encryptedAccessToken = encrypt(accessToken);
      const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : undefined;
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const providers = (user.cloudProviders as any[]) || [];
      const existingIndex = providers.findIndex(p => p.type === provider);
      
      if (existingIndex >= 0) {
        providers[existingIndex] = {
          ...providers[existingIndex],
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          updatedAt: new Date().toISOString(),
        };
      } else {
        providers.push({
          type: provider,
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          connectedAt: new Date().toISOString(),
        });
      }
      
      await prisma.user.update({
        where: { id: userId },
        data: {
          cloudProviders: providers,
        },
      });
      
      logger.info(`Cloud provider connected: ${provider} for user ${userId}`);
      
    } catch (error) {
      logger.error('Failed to connect cloud provider:', error);
      throw new Error(`Failed to connect ${provider}: ${error.message}`);
    }
  }
  
  async getProviderTokens(
    userId: string,
    provider: 'google_drive' | 'dropbox' | 'onedrive'
  ): Promise<{ accessToken: string; refreshToken?: string } | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { cloudProviders: true },
      });
      
      if (!user) {
        return null;
      }
      
      const providers = (user.cloudProviders as any[]) || [];
      const providerData = providers.find(p => p.type === provider);
      
      if (!providerData) {
        return null;
      }
      
      // Decrypt tokens
      const accessToken = decrypt(providerData.accessToken);
      const refreshToken = providerData.refreshToken ? decrypt(providerData.refreshToken) : undefined;
      
      return { accessToken, refreshToken };
      
    } catch (error) {
      logger.error('Failed to get provider tokens:', error);
      return null;
    }
  }
  
  async disconnectProvider(userId: string, provider: 'google_drive' | 'dropbox' | 'onedrive'): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const providers = (user.cloudProviders as any[]) || [];
      const filtered = providers.filter(p => p.type !== provider);
      
      await prisma.user.update({
        where: { id: userId },
        data: {
          cloudProviders: filtered,
        },
      });
      
      logger.info(`Cloud provider disconnected: ${provider} for user ${userId}`);
      
    } catch (error) {
      logger.error('Failed to disconnect cloud provider:', error);
      throw new Error(`Failed to disconnect ${provider}: ${error.message}`);
    }
  }
  
  async backupMeasurement(
    measurementId: string,
    userId: string,
    provider: BackupProvider
  ): Promise<{ success: boolean; backupId: string; url: string }> {
    try {
      // Get decrypted tokens
      const tokens = await this.getProviderTokens(userId, provider.type);
      if (!tokens) {
        throw new Error('Provider not connected');
      }
      
      // Generate JSON export
      const jsonExport = await this.exportService.generateExport(
        measurementId,
        userId,
        {
          format: 'json',
          includeMetadata: true,
          includeConfidence: true,
          includeBodyShape: true,
        }
      );
      
      // Upload to provider using tokens
      const uploadResult = await this.uploadToProvider(
        { ...provider, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken },
        jsonExport.filename,
        jsonExport.url,
        measurementId
      );
      
      // Log backup
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'CLOUD_BACKUP_CREATED',
          resource: 'measurement',
          resourceId: measurementId,
          newValues: {
            provider: provider.type,
            backupId: uploadResult.backupId,
            url: uploadResult.url,
          },
          source: 'ifysora',
        },
      });
      
      return {
        success: true,
        backupId: uploadResult.backupId,
        url: uploadResult.url,
      };
      
    } catch (error) {
      logger.error('Cloud backup failed:', error);
      throw error;
    }
  }
  
  private async uploadToProvider(
    provider: BackupProvider,
    filename: string,
    fileUrl: string,
    measurementId: string
  ): Promise<{ backupId: string; url: string }> {
    // Fetch the file content
    const fileResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    const fileContent = fileResponse.data;
    
    let backupId: string;
    let url: string;
    
    switch (provider.type) {
      case 'google_drive':
        const googleResult = await this.uploadToGoogleDrive(provider.accessToken, fileContent, filename);
        backupId = googleResult.id;
        url = googleResult.webViewLink;
        break;
        
      case 'dropbox':
        const dropboxResult = await this.uploadToDropbox(provider.accessToken, fileContent, filename);
        backupId = dropboxResult.id;
        url = dropboxResult.url;
        break;
        
      case 'onedrive':
        const onedriveResult = await this.uploadToOneDrive(provider.accessToken, fileContent, filename);
        backupId = onedriveResult.id;
        url = onedriveResult.url;
        break;
        
      default:
        throw new Error('Unsupported backup provider');
    }
    
    return { backupId, url };
  }
  
  private async uploadToGoogleDrive(
    accessToken: string,
    fileContent: Buffer,
    filename: string
  ): Promise<{ id: string; webViewLink: string }> {
    const metadata = {
      name: filename,
      mimeType: 'application/json',
      parents: ['root'],
    };
    
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob([fileContent], { type: 'application/json' }), filename);
    
    const response = await axios.post(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      formData,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'multipart/related',
        },
      }
    );
    
    return {
      id: response.data.id,
      webViewLink: `https://drive.google.com/file/d/${response.data.id}/view`,
    };
  }
  
  private async uploadToDropbox(
    accessToken: string,
    fileContent: Buffer,
    filename: string
  ): Promise<{ id: string; url: string }> {
    const response = await axios.post(
      'https://content.dropboxapi.com/2/files/upload',
      fileContent,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: `/${filename}`,
            mode: 'add',
            autorename: true,
            mute: false,
          }),
        },
      }
    );
    
    // Get shared link
    const shareResponse = await axios.post(
      'https://api.dropboxapi.com/2/sharing/create_shared_link',
      {
        path: response.data.path_lower,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return {
      id: response.data.id,
      url: shareResponse.data.url,
    };
  }
  
  private async uploadToOneDrive(
    accessToken: string,
    fileContent: Buffer,
    filename: string
  ): Promise<{ id: string; url: string }> {
    const response = await axios.put(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${filename}:/content`,
      fileContent,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return {
      id: response.data.id,
      url: response.data.webUrl,
    };
  }
  }
