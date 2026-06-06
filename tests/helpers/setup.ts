import { getTestKeyPair } from './auth.helper';
import * as jose from 'jose';

jest.mock('../../src/modules/auth/infrastructure/services/local-keypair.service', () => ({
  initializeKeypair: jest.fn().mockResolvedValue(undefined),
  getPrivateKey: jest.fn(async () => (await getTestKeyPair()).privateKey),
  getPublicKey: jest.fn(async () => (await getTestKeyPair()).publicKey),
  getJWKS: jest.fn(async () => {
    const { publicKey } = await getTestKeyPair();
    const jwk = await jose.exportJWK(publicKey);
    jwk.kid = 'local-key-1';
    jwk.alg = 'RS256';
    jwk.use = 'sig';
    return { keys: [jwk] };
  }),
}));
