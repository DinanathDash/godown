import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { AppError } from '../utils/AppError';
import { prisma } from '../lib/prisma';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        email: string;
        locationId: string | null;
      };
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, role: true, email: true, isActive: true, locationId: true },
    });

    if (!user || !user.isActive) {
      throw new AppError(401, 'UNAUTHENTICATED', 'User not found or inactive');
    }

    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
      locationId: user.locationId,
    };

    next();
  } catch {
    next(new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired token'));
  }
};
