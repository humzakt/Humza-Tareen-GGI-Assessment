import { IUserRepository } from '../../domain/repositories/user.repository.interface';
import { IRefreshTokenRepository } from '../../domain/repositories/refresh-token.repository.interface';
import { hashPassword } from '../../domain/services/password.service';
import { generateTokenPair, parseExpiryToMs } from '../../domain/services/token.service';
import { createAppError } from '../../../../lib/errors/error.template';
import { env } from '../../../../lib/config/env.config';
import crypto from 'crypto';

interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

interface RegisterOutput {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: string };
}

export class RegisterUseCase {
  constructor(
    private userRepo: IUserRepository,
    private refreshTokenRepo: IRefreshTokenRepository,
  ) {}

  async execute(input: RegisterInput): Promise<RegisterOutput> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw createAppError('USER_ALREADY_EXISTS', { email: input.email });
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.userRepo.create({
      email: input.email,
      passwordHash,
      name: input.name,
    });

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
