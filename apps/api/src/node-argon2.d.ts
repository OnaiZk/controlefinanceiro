import 'node:crypto';
declare module 'node:crypto' {
  export interface Argon2Parameters {
    message: string | Buffer;
    nonce: Buffer;
    parallelism: number;
    memory: number;
    passes: number;
    tagLength: number;
  }
  export function argon2(
    algorithm: 'argon2id',
    parameters: Argon2Parameters,
    callback: (error: Error | null, derivedKey: Buffer) => void,
  ): void;
}
