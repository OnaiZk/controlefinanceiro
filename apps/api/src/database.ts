import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { emptyState, seedState } from '../../../packages/shared/src/engine';
import { stateSchema, today, type State } from '../../../packages/shared/src/index';
import {
  operate,
  type Operation,
  type OperationResult,
} from '../../../packages/shared/src/operations';
import { seal, unseal } from './security';

export interface DatabaseAdapter {
  readonly mode: 'local' | 'convex';
  execute(operation: Operation): Promise<OperationResult>;
}
export class MockDatabaseAdapter implements DatabaseAdapter {
  readonly mode = 'local' as const;
  constructor(public state: State = emptyState()) {}
  async execute(operation: Operation) {
    const result = operate(this.state, operation);
    this.state = result.state;
    return structuredClone(result);
  }
}
export class LocalDatabaseAdapter implements DatabaseAdapter {
  readonly mode = 'local' as const;
  private queue: Promise<void> = Promise.resolve();
  constructor(
    private readonly path: string,
    private readonly key: string,
  ) {}
  async execute(operation: Operation): Promise<OperationResult> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      let state: State;
      try {
        state = stateSchema.parse(
          JSON.parse(
            unseal(await readFile(this.path, 'utf8'), this.key, 'entre-contas:database:v1'),
          ),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') state = emptyState();
        else
          throw new Error(
            'Não foi possível abrir os dados locais. Confira a chave ou restaure o backup.',
          );
      }
      const result = operate(state, operation);
      if (operation.kind !== 'read') {
        await mkdir(dirname(this.path), { recursive: true });
        const temp = `${this.path}.tmp`;
        await writeFile(
          temp,
          seal(JSON.stringify(result.state), this.key, 'entre-contas:database:v1'),
          { mode: 0o600 },
        );
        await rename(temp, this.path);
      }
      return result;
    } finally {
      release();
    }
  }
}
export class ConvexDatabaseAdapter implements DatabaseAdapter {
  readonly mode = 'convex' as const;
  private readonly client: ConvexHttpClient;
  constructor(
    url: string,
    private readonly bridge: string,
  ) {
    if (!url || bridge.length < 32)
      throw new Error('Configure CONVEX_URL e BACKEND_BRIDGE_SECRET.');
    this.client = new ConvexHttpClient(url);
  }
  async execute(operation: Operation): Promise<OperationResult> {
    const ref = makeFunctionReference<
      'mutation',
      { secret: string; operationJson: string },
      string
    >('finance:execute');
    const payload =
      operation.kind === 'command' ? { ...operation, localDate: today(operation.now) } : operation;
    const json = await this.client.mutation(ref, {
      secret: this.bridge,
      operationJson: JSON.stringify(payload),
    });
    const result = JSON.parse(json) as OperationResult;
    result.state = stateSchema.parse(result.state);
    return result;
  }
}
let instance: DatabaseAdapter | undefined;
export function database(): DatabaseAdapter {
  if (instance) return instance;
  const hosted = process.env.NETLIFY === 'true' || process.env['NODE_ENV'] === 'production';
  if (process.env.DATABASE_MODE === 'convex') {
    instance = new ConvexDatabaseAdapter(
      process.env.CONVEX_URL ?? '',
      process.env.BACKEND_BRIDGE_SECRET ?? '',
    );
  } else {
    if (hosted)
      throw new Error(
        'Produção exige DATABASE_MODE=convex. Configure o Convex; fallback local está bloqueado.',
      );
    if (!process.env.ENCRYPTION_KEY)
      throw new Error('Execute a configuração local antes de iniciar.');
    instance = new LocalDatabaseAdapter(
      resolve(process.env.LOCAL_DATA_PATH ?? '.local/finance.enc'),
      process.env.ENCRYPTION_KEY,
    );
  }
  return instance;
}
export async function initializedDatabase() {
  const db = database();
  let result = await db.execute({ kind: 'read' });
  if (!result.state.users.length) {
    const users: State['users'] = (['CAS', 'KET'] as const).map((slug) => ({
      id: slug,
      slug,
      name: slug === 'CAS' ? 'Cassiano' : 'Kethellen',
      email: process.env[`${slug}_EMAIL`] ?? '',
      passwordHash: process.env[`${slug}_PASSWORD_HASH`] ?? '',
    }));
    if (users.some((u) => !u.email || !u.passwordHash.startsWith('$argon2id$')))
      throw new Error('Configure os dois emails e os hashes Argon2 do bootstrap.');
    result = await db.execute({
      kind: 'initialize',
      state: seedState(users, Date.now(), process.env.SEED_DEMO_DATA === 'true'),
    });
  }
  return { db, state: result.state };
}
