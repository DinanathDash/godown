import { prisma } from '../src/lib/prisma';
import { hashPassword } from '../src/lib/password';
import { Role } from '@prisma/client';

export const createTestUser = async (role: Role = Role.ADMIN) => {
  const email = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
  const password = 'Password@123';
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name: `Test ${role}`,
      email,
      passwordHash,
      role,
    },
  });

  return { user, email, password };
};

export const clearTestUser = async (email: string) => {
  await prisma.user.deleteMany({ where: { email } });
};
