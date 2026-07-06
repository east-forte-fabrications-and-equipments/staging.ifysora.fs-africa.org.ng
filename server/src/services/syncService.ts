import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export class SyncService {
  private baseUrl: string;
  private apiKey: string;
  
  constructor() {
    this.baseUrl = env.FYSORA_FASHN_API_URL;
    this.apiKey = env.FYSORA_FASHN_API_KEY;
  }
  
  async syncUser(user: any) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/ecosystem/users`,
        {
          email: user.email,
          phone: user.phone,
          displayName: user.displayName,
          role: user.role,
          verificationLevel: user.verificationLevel,
          source: 'ifysora',
        },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error('Failed to sync user to FYSORA FASHN:', error);
      throw error;
    }
  }
  
  async syncMeasurement(user: any, measurement: any) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/ecosystem/measurements`,
        {
          userId: user.ecosystemUserId || user.fysoraUserId,
          measurementId: measurement.id,
          sessionId: measurement.sessionId,
          measurements: measurement.data,
          bodyShape: measurement.bodyShape,
          timestamp: measurement.timestamp,
          source: 'ifysora',
        },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error('Failed to sync measurement to FYSORA FASHN:', error);
      throw error;
    }
  }
  
  async syncOrganization(organization: any) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/ecosystem/organizations`,
        {
          id: organization.id,
          name: organization.name,
          type: organization.type,
          registrationNumber: organization.registrationNumber,
          source: 'ifysora',
        },
        {
          headers: {
            'X-API-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      
      return response.data;
    } catch (error) {
      logger.error('Failed to sync organization to FYSORA FASHN:', error);
      throw error;
    }
  }
}
