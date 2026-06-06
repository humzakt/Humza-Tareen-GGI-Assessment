import * as jose from 'jose';
import crypto from 'crypto';

let testPrivateKey: CryptoKey | null = null;
let testPublicKey: CryptoKey | null = null;

type CryptoKey = Awaited<ReturnType<typeof jose.generateKeyPair>>['privateKey'];

export async function getTestKeyPair(): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey }> {
  if (!testPrivateKey || !testPublicKey) {
    const pair = await jose.generateKeyPair('RS256', { modulusLength: 2048 });
    testPrivateKey = pair.privateKey;
    testPublicKey = pair.publicKey;
  }
  return { privateKey: testPrivateKey, publicKey: testPublicKey };
}

export async function generateTestToken(payload: {
  sub: string;
  email: string;
  role: string;
  expired?: boolean;
}): Promise<string> {
  const { privateKey } = await getTestKeyPair();

  const builder = new jose.SignJWT({
    email: payload.email,
    role: payload.role,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'local-key-1' })
    .setSubject(payload.sub)
    .setIssuer('http://localhost:3000')
    .setAudience('local-api')
    .setIssuedAt();

  if (payload.expired) {
    builder.setExpirationTime(Math.floor(Date.now() / 1000) - 3600);
  } else {
    builder.setExpirationTime('15m');
  }

  return builder.sign(privateKey);
}

export function generateHmacSignature(
  method: string,
  path: string,
  body: string,
  timestamp: number,
  secret: string = 'local-dev-hmac-secret-change-in-production',
): string {
  const payload = `${timestamp}${method}${path}${body}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export interface AuthHeaders {
  [key: string]: string;
  Authorization: string;
  'x-request-timestamp': string;
  'x-request-signature': string;
  'Content-Type': string;
}

export async function getAuthHeaders(
  method: string,
  path: string,
  body: object | string = '',
  userOverrides?: { sub?: string; email?: string; role?: string },
): Promise<AuthHeaders> {
  const token = await generateTestToken({
    sub: userOverrides?.sub ?? 'test-user-id',
    email: userOverrides?.email ?? 'test@test.com',
    role: userOverrides?.role ?? 'USER',
  });

  const timestamp = Date.now();
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  const signature = generateHmacSignature(method, path, bodyStr, timestamp);

  return {
    Authorization: `Bearer ${token}`,
    'x-request-timestamp': timestamp.toString(),
    'x-request-signature': signature,
    'Content-Type': 'application/json',
  };
}
