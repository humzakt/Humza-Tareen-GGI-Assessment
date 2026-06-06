import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';
import { generateTokenPair, parseExpiryToMs } from '../../domain/services/token.service';
import { createAppError } from '../../../../lib/errors/error.template';
import { env } from '../../../../lib/config/env.config';
import crypto from 'crypto';

interface RefreshOutput {
  accessToken: string;
  refreshToken: string;
}

export class RefreshTokenUseCase {
  constructor(
    private userRepo: IUserRepository,
    private refreshTokenRepo: IRefreshTokenRepository,
  ) {}

  async execute(refreshToken: string): Promise<RefreshOutput> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = await this.refreshTokenRepo.findByTokenHash(tokenHash);

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw createAppError('REFRESH_TOKEN_INVALID');
    }

    await this.refreshTokenRepo.revoke(stored.id);

    const user = await this.userRepo.findById(stored.userId);
    if (!user) {
      throw createAppError('USER_NOT_FOUND');
    }

    const tokens = await generateTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const newTokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + parseExpiryToMs(env.JWT_REFRESH_EXPIRY));
    await this.refreshTokenRepo.create(user.id, newTokenHash, expiresAt);

    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }
}
