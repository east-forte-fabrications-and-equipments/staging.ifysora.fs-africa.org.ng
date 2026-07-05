import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AuditService } from '../services/auditService.js';
import { SyncService } from '../services/syncService.js';
import { logger } from '../utils/logger.js';

export class AuthController {
  private auditService: AuditService;
  private syncService: SyncService;
  
  constructor() {
    this.auditService = AuditService.getInstance();
    this.syncService = new SyncService();
  }
  
  async register(req: Request, res: Response) {
    try {
      const { email, phone, password, displayName, role = 'CUSTOMER' } = req.body;
      
      // Validate role (iFYSORA can only register Tailors, Designers, Organizations)
      const allowedRoles = ['TAILOR', 'DESIGNER', 'ORGANIZATION'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          error: `iFYSORA can only register Tailors, Designers, or Organizations. ${role} is not allowed.`,
        });
      }
      
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: email.toLowerCase() },
            { phone },
          ],
        },
      });
      
      if (existingUser) {
        return res.status(400).json({
          error: 'User with this email or phone already exists',
        });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Create user
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          phone,
          passwordHash: hashedPassword,
          displayName,
          role,
          verificationLevel: 1, // Email + Phone verification
          isVerified: false,
        },
      });
      
      // Sync with FYSORA FASHN
      try {
        const synced = await this.syncService.syncUser(user);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            ecosystemUserId: synced.id,
            fysoraUserId: synced.fysoraUserId,
          },
        });
      } catch (syncError) {
        logger.error('Failed to sync user to FYSORA FASHN:', syncError);
        // Don't fail registration if sync fails
      }
      
      // Audit log
      await this.auditService.log({
        userId: user.id,
        action: 'USER_REGISTERED',
        resource: 'user',
        resourceId: user.id,
        newValues: { email: user.email, role: user.role },
        source: 'ifysora',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      // Generate tokens
      const tokens = this.generateTokens(user);
      
      // Create session
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });
      
      return res.status(201).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          verificationLevel: user.verificationLevel,
          isVerified: user.isVerified,
        },
        ...tokens,
        notice: {
          message: 'By creating an account on iFYSORA, you are also creating a FYSORA FASHN ecosystem account. Your credentials, profile information, and measurement records may be available across FYSORA services according to our Terms of Service and Privacy Policy.',
          accepted: false,
          required: true,
        },
      });
      
    } catch (error) {
      logger.error('Registration error:', error);
      return res.status(500).json({
        error: 'Registration failed',
        details: error.message,
      });
    }
  }
  
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: {
          id: true,
          email: true,
          passwordHash: true,
          displayName: true,
          role: true,
          verificationLevel: true,
          isVerified: true,
          subscriptionStatus: true,
          planId: true,
        },
      });
      
      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials',
        });
      }
      
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid credentials',
        });
      }
      
      // Generate tokens
      const tokens = this.generateTokens(user);
      
      // Create session
      await prisma.session.create({
        data: {
          userId: user.id,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });
      
      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
      
      await this.auditService.log({
        userId: user.id,
        action: 'USER_LOGIN',
        resource: 'user',
        resourceId: user.id,
        source: 'ifysora',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          verificationLevel: user.verificationLevel,
          isVerified: user.isVerified,
          subscriptionStatus: user.subscriptionStatus,
          planId: user.planId,
        },
        ...tokens,
      });
      
    } catch (error) {
      logger.error('Login error:', error);
      return res.status(500).json({
        error: 'Login failed',
        details: error.message,
      });
    }
  }
  
  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          error: 'Refresh token required',
        });
      }
      
      const session = await prisma.session.findFirst({
        where: {
          refreshToken,
          expiresAt: { gt: new Date() },
          revokedAt: null,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              displayName: true,
              role: true,
              verificationLevel: true,
              isVerified: true,
            },
          },
        },
      });
      
      if (!session) {
        return res.status(401).json({
          error: 'Invalid or expired refresh token',
        });
      }
      
      // Generate new tokens
      const tokens = this.generateTokens(session.user);
      
      // Revoke old session
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      
      // Create new session
      await prisma.session.create({
        data: {
          userId: session.user.id,
          refreshToken: tokens.refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        },
      });
      
      return res.json(tokens);
      
    } catch (error) {
      logger.error('Refresh token error:', error);
      return res.status(500).json({
        error: 'Token refresh failed',
        details: error.message,
      });
    }
  }
  
  async logout(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      
      // Revoke all sessions for this user
      await prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      
      await this.auditService.log({
        userId,
        action: 'USER_LOGOUT',
        resource: 'user',
        resourceId: userId,
        source: 'ifysora',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      
      return res.json({
        success: true,
        message: 'Logged out successfully',
      });
      
    } catch (error) {
      logger.error('Logout error:', error);
      return res.status(500).json({
        error: 'Logout failed',
        details: error.message,
      });
    }
  }
  
  private generateTokens(user: any) {
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        verificationLevel: user.verificationLevel,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRY }
    );
    
    const refreshToken = jwt.sign(
      {
        sub: user.id,
        type: 'refresh',
      },
      env.JWT_SECRET,
      { expiresIn: env.REFRESH_TOKEN_EXPIRY }
    );
    
    return { accessToken, refreshToken };
  }
                                  }
