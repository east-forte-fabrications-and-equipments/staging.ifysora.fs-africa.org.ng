import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

export interface AuthRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
    verificationLevel: number;
  };
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies?.accessToken;
    
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please provide a valid JWT token',
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      sub: string;
      email: string;
      role: string;
      verificationLevel: number;
    };

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        role: true,
        verificationLevel: true,
        subscriptionStatus: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt) {
      return res.status(401).json({
        error: 'User not found or account deactivated',
      });
    }

    // Attach user to request
    (req as AuthRequest).user = {
      id: user.id,
      email: user.email,
      role: user.role,
      verificationLevel: user.verificationLevel,
    };

    next();
    
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Please refresh your token',
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Token validation failed',
      });
    }

    logger.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication',
    });
  }
}

 
