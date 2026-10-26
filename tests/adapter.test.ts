import { describe, expect, it } from 'vitest';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LocalDatabaseAdapter, MockDatabaseAdapter } from '../apps/api/src/database';
import { seedState } from '../packages/shared/src/engine';
const seed = () =>
  seedState(
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
    true,
  );
describe('adapters e persistência', () => {
  it('mock implementa o contrato sem depender de fornecedor', async () => {
    const db = new MockDatabaseAdapter();
    await db.execute({ kind: 'initialize', state: seed() });
    expect((await db.execute({ kind: 'read' })).state.users).toHaveLength(2);
  });
  it('arquivo persiste criptografado e aprova concorrência uma única vez', async () => {
    const folder = resolve('.local/adapter-tests');
    await mkdir(folder, { recursive: true });
    const file = resolve(folder, randomUUID() + '.enc');
    const key = 'f'.repeat(64);
    const db = new LocalDatabaseAdapter(file, key);
    const state = seed();
    state.transactions = [];
    await db.execute({ kind: 'initialize', state });
    const imported = await db.execute({
      kind: 'import',
      actor: 'CAS',
      accountId: 'acc-cas',
      records: [
        {
          externalId: 'tx1',
          description: 'PRIVATE_DESCRIPTION_FIXTURE',
          amountCents: 12345,
          type: 'EXPENSE',
          occurredAt: '2026-10-20',
        },
      ],
      source: 'FILE',
      now: Date.now(),
      requestId: 'batch',
    });
    expect(imported.imported).toBe(1);
    const results = await Promise.allSettled([
      db.execute({
        kind: 'command',
        actor: 'CAS',
        command: { kind: 'review', id: 'batch-0', approve: true },
        now: Date.now(),
        requestId: 'r1',
      }),
      db.execute({
        kind: 'command',
        actor: 'CAS',
        command: { kind: 'review', id: 'batch-0', approve: true },
        now: Date.now(),
        requestId: 'r2',
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await readFile(file, 'utf8')).not.toContain('PRIVATE_DESCRIPTION_FIXTURE');
    expect(await readFile(file, 'utf8')).not.toContain('12345');
    const reopened = new LocalDatabaseAdapter(file, key);
    expect((await reopened.execute({ kind: 'read' })).state.transactions[0].status).toBe('PAID');
    await expect(
      new LocalDatabaseAdapter(file, 'e'.repeat(64)).execute({ kind: 'read' }),
    ).rejects.toThrow('chave');
  });
  it('sessão revogada é removida do estado persistido', async () => {
    const db = new MockDatabaseAdapter(seed());
    await db.execute({
      kind: 'startSession',
      actor: 'CAS',
      key: 'email-digest',
      sessionId: 'sid',
      tokenHash: 'opaque-token-hash',
      now: Date.now(),
      expiresAt: Date.now() + 60000,
    });
    await db.execute({ kind: 'endSession', actor: 'CAS', sessionId: 'sid', now: Date.now() });
    expect((await db.execute({ kind: 'read' })).state.sessions).toHaveLength(0);
  });
});
