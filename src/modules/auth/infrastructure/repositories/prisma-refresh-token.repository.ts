import { prisma } from '../../../../lib/prisma/client';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';

export class PrismaRefreshTokenRepository implements IRefreshTokenRepository {
  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<{ id: string; userId: string; expiresAt: Date; revoked: boolean } | null> {
    return prisma.refreshToken.findFirst({ where: { tokenHash } });
  }

  async revoke(id: string): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { revoked: true },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }
}
