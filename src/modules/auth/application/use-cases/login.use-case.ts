import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';
import { verifyPassword } from '../../domain/services/password.service';
import { generateTokenPair, parseExpiryToMs } from '../../domain/services/token.service';
import { createAppError } from '../../../../lib/errors/error.template';
import { env } from '../../../../lib/config/env.config';
import crypto from 'crypto';

interface LoginInput {
  email: string;
  password: string;
}

interface LoginOutput {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: string };
}

export class LoginUseCase {
  constructor(
    private userRepo: IUserRepository,
    private refreshTokenRepo: IRefreshTokenRepository,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) {
      throw createAppError('INVALID_CREDENTIALS');
    }

    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      throw createAppError('INVALID_CREDENTIALS');
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
