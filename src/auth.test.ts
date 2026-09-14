import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword, ensureDefaultAuth, verifyLogin, changeCredentials, DEFAULT_LOGIN, DEFAULT_PASSWORD } from './auth';
import { getState, resetStateForTests } from './state';

describe('auth', () => {
  beforeEach(() => {
    localStorage.clear();
    resetStateForTests();
  });

  it('hashes with SHA-256 (known test vector)', async () => {
    expect(await hashPassword('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await hashPassword('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('seeds default credentials only when none exist', async () => {
    await ensureDefaultAuth();
    expect(getState().auth?.login).toBe(DEFAULT_LOGIN);
    await changeCredentials('someone', 'newpass123');
    await ensureDefaultAuth();
    expect(getState().auth?.login).toBe('someone');
  });

  it('verifies correct and rejects incorrect login', async () => {
    await ensureDefaultAuth();
    expect(await verifyLogin(DEFAULT_LOGIN, DEFAULT_PASSWORD)).toBe(true);
    expect(await verifyLogin(DEFAULT_LOGIN, 'wrong')).toBe(false);
    expect(await verifyLogin('wrong-user', DEFAULT_PASSWORD)).toBe(false);
  });

  it('changeCredentials updates login and password hash', async () => {
    await ensureDefaultAuth();
    await changeCredentials('newlogin', 'newpassword1');
    expect(await verifyLogin('newlogin', 'newpassword1')).toBe(true);
    expect(await verifyLogin(DEFAULT_LOGIN, DEFAULT_PASSWORD)).toBe(false);
  });
});
