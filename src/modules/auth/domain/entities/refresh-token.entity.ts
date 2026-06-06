export interface RefreshTokenEntity {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}
