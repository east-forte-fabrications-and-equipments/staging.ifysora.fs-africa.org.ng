import { Request, Response } from 'express';
import { SyncService } from '../services/syncService.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

export class SyncController {
  private syncService: SyncService;

  constructor() {
    this.syncService = new SyncService();
  }

  async syncUser(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const result = await this.syncService.syncUser(user);

      // Update user with sync info
      await prisma.user.update({
        where: { id: userId },
        data: {
          ecosystemUserId: result.id,
          fysoraUserId: result.fysoraUserId,
        },
      });

      return res.json({
        success: true,
        synced: result,
      });

    } catch (error) {
      logger.error('Sync user error:', error);
      return res.status(500).json({
        error: 'Failed to sync user',
        details: error.message,
      });
    }
  }

  async syncMeasurement(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      const measurement = await prisma.measurement.findFirst({
        where: {
          id,
          userId,
        },
        include: {
          user: true,
        },
      });

      if (!measurement) {
        return res.status(404).json({ error: 'Measurement not found' });
      }

      const result = await this.syncService.syncMeasurement(measurement.user, measurement);

      // Update measurement with sync info
      await prisma.measurement.update({
        where: { id },
        data: {
          syncedToFysora: true,
          fysoraMeasurementId: result.id,
          syncedAt: new Date(),
        },
      });

      return res.json({
        success: true,
        synced: result,
      });

    } catch (error) {
      logger.error('Sync measurement error:', error);
      return res.status(500).json({
        error: 'Failed to sync measurement',
        details: error.message,
      });
    }
  }

  async syncStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          ecosystemUserId: true,
          fysoraUserId: true,
          measurements: {
            select: {
              id: true,
              syncedToFysora: true,
              fysoraMeasurementId: true,
              syncedAt: true,
            },
            take: 10,
            orderBy: { timestamp: 'desc' },
          },
        },
      });

      const totalMeasurements = await prisma.measurement.count({
        where: { userId },
      });

      const syncedMeasurements = await prisma.measurement.count({
        where: {
          userId,
          syncedToFysora: true,
        },
      });

      return res.json({
        user: {
          ecosystemUserId: user?.ecosystemUserId,
          fysoraUserId: user?.fysoraUserId,
        },
        measurements: {
          total: totalMeasurements,
          synced: syncedMeasurements,
          pending: totalMeasurements - syncedMeasurements,
          recent: user?.measurements || [],
        },
      });

    } catch (error) {
      logger.error('Sync status error:', error);
      return res.status(500).json({
        error: 'Failed to get sync status',
        details: error.message,
      });
    }
  }

  async forceSync(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;

      // Sync user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (user) {
        await this.syncService.syncUser(user);
      }

      // Sync unsynced measurements
      const unsynced = await prisma.measurement.findMany({
        where: {
          userId,
          syncedToFysora: false,
        },
        include: {
          user: true,
        },
        take: 100,
      });

      const results = [];
      for (const measurement of unsynced) {
        try {
          const result = await this.syncService.syncMeasurement(measurement.user, measurement);
          await prisma.measurement.update({
            where: { id: measurement.id },
            data: {
              syncedToFysora: true,
              fysoraMeasurementId: result.id,
              syncedAt: new Date(),
            },
          });
          results.push({ id: measurement.id, success: true });
        } catch (error) {
          logger.error(`Failed to sync measurement ${measurement.id}:`, error);
          results.push({ id: measurement.id, success: false, error: error.message });
        }
      }

      return res.json({
        success: true,
        synced: {
          user: true,
          measurements: results,
        },
      });

    } catch (error) {
      logger.error('Force sync error:', error);
      return res.status(500).json({
        error: 'Failed to force sync',
        details: error.message,
      });
    }
  }
}
