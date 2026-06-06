import { prisma } from '../../../../lib/prisma/client';
import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { CreateUserInput, UserEntity } from '../../domain/entities/user.entity';

export class PrismaUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<UserEntity | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async create(input: CreateUserInput): Promise<UserEntity> {
    return prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
        role: input.role ?? 'USER',
        authProvider: input.authProvider ?? 'LOCAL',
        freeMessagesUsed: 0,
        freeQuotaResetDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    });
  }

  async updateFreeQuota(userId: string, messagesUsed: number, resetDate: Date): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { freeMessagesUsed: messagesUsed, freeQuotaResetDate: resetDate },
    });
  }
}
