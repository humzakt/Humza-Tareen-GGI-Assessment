export interface IRefreshTokenRepository {
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<{ id: string; userId: string; expiresAt: Date; revoked: boolean } | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
