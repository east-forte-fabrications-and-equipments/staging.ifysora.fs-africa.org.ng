import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';

describe('Measurement API Integration', () => {
  let authToken: string;
  let measurementId: string;

  beforeAll(async () => {
    // Login to get token
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test123!@#',
      });

    authToken = response.body.accessToken;
  });

  describe('POST /api/measurements/analyze', () => {
    it('should analyze measurements with valid data', async () => {
      const response = await request(app)
        .post('/api/measurements/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          frontImage: 'data:image/png;base64,test',
          sideImage: 'data:image/png;base64,test',
          userHeightCm: 175,
          clientName: 'Integration Test',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.measurement).toBeDefined();
      
      measurementId = response.body.measurement.measurementId;
    });

    it('should reject invalid height', async () => {
      const response = await request(app)
        .post('/api/measurements/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          frontImage: 'data:image/png;base64,test',
          sideImage: 'data:image/png;base64,test',
          userHeightCm: 10, // Invalid height
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/measurements', () => {
    it('should return measurement history', async () => {
      const response = await request(app)
        .get('/api/measurements')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.measurements)).toBe(true);
    });
  });
});
