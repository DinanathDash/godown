import { prisma } from '../../lib/prisma';
import { comparePassword } from '../../lib/password';
import { signToken } from '../../lib/jwt';
import { AppError } from '../../utils/AppError';

export const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.isActive) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid email or password');
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid email or password');
  }

  const accessToken = signToken({
    sub: user.id,
    role: user.role,
    email: user.email,
    locationId: user.locationId,
  });

  return {
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      locationId: user.locationId,
    },
  };
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      locationId: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  return user;
};
