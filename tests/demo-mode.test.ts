import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializedDatabase, MockDatabaseAdapter } from '../apps/api/src/database';
import { getSnapshot, syncBank } from '../apps/api/src/service';
import { digest, signSession } from '../apps/api/src/security';
import { seedState } from '../packages/shared/src/engine';
import { today } from '../packages/shared/src/index';

vi.mock('../apps/api/src/database', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../apps/api/src/database')>()),
  initializedDatabase: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
async function fixture(demo: boolean) {
  vi.stubEnv('JWT_SECRET', 'a'.repeat(64));
  vi.stubEnv('SEED_DEMO_DATA', String(demo));
  const state = seedState(
    [
      {
        id: 'CAS',
        slug: 'CAS',
        name: 'Cassiano',
        email: 'cas@example.com',
        passwordHash: 'fixture',
      },
      {
        id: 'KET',
        slug: 'KET',
        name: 'Kethellen',
        email: 'ket@example.com',
        passwordHash: 'fixture',
      },
    ],
    Date.now(),
    false,
  );
  state.accounts.push({
    id: 'qa-account',
    ownerScope: 'CAS',
    name: 'QA',
    institution: 'QA',
    type: 'CHECKING',
    balanceCents: 0,
    archived: false,
  });
  const db = new MockDatabaseAdapter(state);
  const expiresAt = Date.now() + 60000;
  const token = await signSession('CAS', 'qa-session', 'a'.repeat(64), expiresAt);
  await db.execute({
    kind: 'startSession',
    actor: 'CAS',
    key: 'qa',
    sessionId: 'qa-session',
    tokenHash: digest(token),
    now: Date.now(),
    expiresAt,
  });
  vi.mocked(initializedDatabase).mockImplementation(async () => ({
    db,
    state: (await db.execute({ kind: 'read' })).state,
  }));
  return { db, token };
}
describe('simulação só em demonstração explícita', () => {
  it('base real local não aceita movimentos mock nem por chamada direta à API', async () => {
    const { db, token } = await fixture(false);
    await expect(
      syncBank(token, { provider: 'MOCK', accountId: 'qa-account' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(db.state.transactions).toEqual([]);
    expect((await getSnapshot(token, 'INDIVIDUAL', today().slice(0, 7))).demoEnabled).toBe(false);
  });
  it('mantém o mock de desenvolvimento somente quando optado explicitamente', async () => {
    const { token } = await fixture(true);
    expect(
      (await syncBank(token, { provider: 'MOCK', accountId: 'qa-account' })).imported,
    ).toBeGreaterThan(0);
    expect((await getSnapshot(token, 'INDIVIDUAL', today().slice(0, 7))).demoEnabled).toBe(true);
  });
});
