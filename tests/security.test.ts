import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  readSession,
  seal,
  signSession,
  unseal,
  verifyPassword,
} from '../apps/api/src/security';
const key = 'a'.repeat(64);
describe('segurança', () => {
  it('Argon2id usa salt e valida somente a senha correta', async () => {
    const password = 'test-only-password-123';
    const first = await hashPassword(password),
      second = await hashPassword(password);
    expect(first).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword('wrong', first)).toBe(false);
  });
  it('AES-GCM usa IV único e autentica o contexto do titular', () => {
    const a = seal('secret-fixture', key, 'pluggy:CAS'),
      b = seal('secret-fixture', key, 'pluggy:CAS');
    expect(a).not.toBe(b);
    expect(a).not.toContain('secret-fixture');
    expect(unseal(a, key, 'pluggy:CAS')).toBe('secret-fixture');
    expect(() => unseal(a, key, 'pluggy:KET')).toThrow();
    expect(() => unseal(a, 'b'.repeat(64), 'pluggy:CAS')).toThrow();
  });
  it('recusa ciphertext adulterado', () => {
    const a = seal('secret-fixture', key, 'context');
    const parts = a.split('.');
    parts[2] = Buffer.alloc(16, 3).toString('base64url');
    expect(() => unseal(parts.join('.'), key, 'context')).toThrow();
  });
  it('JWT vincula identidade, sessão, algoritmo, emissor e audiência', async () => {
    const token = await signSession('CAS', 'session-fixture', key, Date.now() + 60000);
    expect(await readSession(token, key)).toEqual({ slug: 'CAS', sessionId: 'session-fixture' });
    await expect(readSession(token, 'b'.repeat(64))).rejects.toThrow();
    const tampered = token.split('.');
    tampered[1] = Buffer.from(JSON.stringify({ sub: 'KET', sid: 'session-fixture' })).toString(
      'base64url',
    );
    await expect(readSession(tampered.join('.'), key)).rejects.toThrow();
  });
  it('recusa JWT expirado', async () => {
    const token = await signSession('KET', 'expired', key, Date.now() - 1000);
    await expect(readSession(token, key)).rejects.toThrow();
  });
});
