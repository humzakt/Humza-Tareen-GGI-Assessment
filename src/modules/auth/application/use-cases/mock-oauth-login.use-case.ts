import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';
import { hashPassword } from '../../domain/services/password.service';
import { generateTokenPair, parseExpiryToMs } from '../../domain/services/token.service';
import { env } from '../../../../lib/config/env.config';
import crypto from 'crypto';

interface MockOAuthOutput {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: string };
}

export class MockOAuthLoginUseCase {
  constructor(
    private userRepo: IUserRepository,
    private refreshTokenRepo: IRefreshTokenRepository,
  ) {}

  async execute(email: string): Promise<MockOAuthOutput> {
    let user = await this.userRepo.findByEmail(email);

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await hashPassword(randomPassword);
      user = await this.userRepo.create({
        email,
        passwordHash,
        name: email.split('@')[0] ?? 'OAuth User',
        authProvider: 'GOOGLE_MOCK',
      });
    }

    const tokens = await generateTokenPair({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const tokenHash = crypto.createHash('sha256').update(tokens.refreshToken).digest('hex');
    const expiresAt = new Date(Date.now() + parseExpiryToMs(env.JWT_REFRESH_EXPIRY));
    await this.refreshTokenRepo.create(user.id, tokenHash, expiresAt);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }
}
