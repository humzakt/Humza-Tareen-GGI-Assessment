import * as jose from 'jose';
import fs from 'fs';
import path from 'path';
import { logger } from '../../../../lib/logger/logger';
import { LOG_EVENTS, LOG_MODULES } from '../../../../lib/logger/logger.constants';

type CryptoKey = Awaited<ReturnType<typeof jose.importPKCS8>>;

const KEYS_DIR = path.resolve(process.cwd(), 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.pem');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.pem');

let privateKey: CryptoKey | null = null;
let publicKey: CryptoKey | null = null;
let jwk: jose.JWK | null = null;

export async function initializeKeypair(): Promise<void> {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
    const privatePem = fs.readFileSync(PRIVATE_KEY_PATH, 'utf-8');
    const publicPem = fs.readFileSync(PUBLIC_KEY_PATH, 'utf-8');

    privateKey = await jose.importPKCS8(privatePem, 'RS256');
    publicKey = await jose.importSPKI(publicPem, 'RS256');

    const exported = await jose.exportJWK(publicKey);
    exported.kid = 'local-key-1';
    exported.alg = 'RS256';
    exported.use = 'sig';
    jwk = exported;

    logger.info(LOG_EVENTS.KEYPAIR_LOADED, { module: LOG_MODULES.AUTH }, {
      path: KEYS_DIR,
    });
  } else {
    const { privateKey: priv, publicKey: pub } = await jose.generateKeyPair('RS256', {
      modulusLength: 2048,
      extractable: true,
    });

    const privatePem = await jose.exportPKCS8(priv);
    const publicPem = await jose.exportSPKI(pub);

    fs.writeFileSync(PRIVATE_KEY_PATH, privatePem);
    fs.writeFileSync(PUBLIC_KEY_PATH, publicPem);

    privateKey = priv;
    publicKey = pub;

    const exported = await jose.exportJWK(pub);
    exported.kid = 'local-key-1';
    exported.alg = 'RS256';
    exported.use = 'sig';
    jwk = exported;

    logger.info(LOG_EVENTS.KEYPAIR_GENERATED, { module: LOG_MODULES.AUTH }, {
      path: KEYS_DIR,
    });
  }
}

export async function getPrivateKey(): Promise<CryptoKey> {
  if (!privateKey) {
    await initializeKeypair();
  }
  return privateKey!;
}

export async function getPublicKey(): Promise<CryptoKey> {
  if (!publicKey) {
    await initializeKeypair();
  }
  return publicKey!;
}

export async function getJWKS(): Promise<{ keys: jose.JWK[] }> {
  if (!jwk) {
    await initializeKeypair();
  }
  return { keys: [jwk!] };
}
