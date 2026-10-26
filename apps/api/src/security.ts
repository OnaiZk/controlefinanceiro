import {
  argon2,
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { slugSchema, type Slug } from '../../../packages/shared/src/index';

const ARGON = { parallelism: 1, memory: 65536, passes: 3, tagLength: 32 };
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    argon2('argon2id', { ...ARGON, message: password, nonce: salt }, (error, derived) =>
      error ? reject(error) : resolve(derived),
    ),
  );
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await derive(password, salt);
  return `$argon2id$v=19$m=65536,t=3,p=1$${salt.toString('base64').replace(/=+$/, '')}$${derived.toString('base64').replace(/=+$/, '')}`;
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const match = /^\$argon2id\$v=19\$m=65536,t=3,p=1\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(
    hash,
  );
  if (!match || password.length > 256) return false;
  const derived = await derive(password, Buffer.from(match[1], 'base64'));
  const expected = Buffer.from(match[2], 'base64');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
export function keyBytes(value: string, name = 'ENCRYPTION_KEY'): Buffer {
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new Error(`${name} deve conter 64 caracteres hexadecimais aleatórios.`);
  return Buffer.from(value, 'hex');
}
export function seal(plaintext: string, key: string, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(key), iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}
export function unseal(envelope: string, key: string, context: string): string {
  const [version, iv, tag, content] = envelope.split('.');
  if (version !== 'v1' || !iv || !tag || !content)
    throw new Error('Envelope criptográfico inválido.');
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(key), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(content, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
export function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left),
    b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function signSession(
  slug: Slug,
  sessionId: string,
  secret: string,
  expiresAt: number,
): Promise<string> {
  keyBytes(secret, 'JWT_SECRET');
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(slug)
    .setIssuer('entre-contas')
    .setAudience('entre-contas-clients')
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .sign(Buffer.from(secret, 'hex'));
}
export async function readSession(
  token: string,
  secret: string,
): Promise<{ slug: Slug; sessionId: string }> {
  const { payload } = await jwtVerify(token, keyBytes(secret, 'JWT_SECRET'), {
    algorithms: ['HS256'],
    issuer: 'entre-contas',
    audience: 'entre-contas-clients',
    typ: 'JWT',
  });
  if (typeof payload.sid !== 'string') throw new Error('Sessão inválida.');
  return { slug: slugSchema.parse(payload.sub), sessionId: payload.sid };
}
