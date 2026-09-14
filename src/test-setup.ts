import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) {
  // jsdom does not implement SubtleCrypto; Node's webcrypto does.
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
