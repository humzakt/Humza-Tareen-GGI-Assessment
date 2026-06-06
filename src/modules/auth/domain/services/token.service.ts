import * as jose from 'jose';
import { env } from '../../../../lib/config/env.config';
import { getPrivateKey } from '../../infrastructure/services/local-keypair.service';

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function generateTokenPair(payload: TokenPayload): Promise<TokenPair> {
  const privateKey = await getPrivateKey();

  const accessToken = await new jose.SignJWT({
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'local-key-1' })
    .setSubject(payload.sub)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_EXPIRY)
    .sign(privateKey);

  const refreshToken = await new jose.SignJWT({
    email: payload.email,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'local-key-1' })
    .setSubject(payload.sub)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(env.JWT_REFRESH_EXPIRY)
    .sign(privateKey);

  return { accessToken, refreshToken };
}

export function parseExpiryToMs(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000;

  const value = parseInt(match[1]!, 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 15 * 60 * 1000;
  }
}
