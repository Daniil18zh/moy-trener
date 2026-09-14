import { beforeEach, describe, expect, it } from 'vitest';
import { isAuthenticated, markAuthenticated, resetAuthenticationForTests, subscribeAuth } from './sessionAuth';

describe('sessionAuth', () => {
  beforeEach(() => {
    resetAuthenticationForTests();
  });

  it('starts unauthenticated', () => {
    expect(isAuthenticated()).toBe(false);
  });

  it('notifies subscribers when markAuthenticated is called', () => {
    let callCount = 0;
    subscribeAuth(() => {
      callCount += 1;
    });

    markAuthenticated();

    expect(callCount).toBe(1);
    expect(isAuthenticated()).toBe(true);
  });

  it('resetAuthenticationForTests resets isAuthenticated back to false', () => {
    markAuthenticated();
    expect(isAuthenticated()).toBe(true);

    resetAuthenticationForTests();

    expect(isAuthenticated()).toBe(false);
  });

  it('unsubscribe stops further notifications', () => {
    let callCount = 0;
    const unsubscribe = subscribeAuth(() => {
      callCount += 1;
    });

    unsubscribe();
    markAuthenticated();

    expect(callCount).toBe(0);
  });
});
