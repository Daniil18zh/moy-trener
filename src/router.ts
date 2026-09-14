import type { AppState } from './types';
import { getState, subscribe } from './state';
import { isAuthenticated, subscribeAuth } from './sessionAuth';

export type ScreenName = 'login' | 'onboarding' | 'home' | 'workout' | 'settings';

const KNOWN_SCREENS: ScreenName[] = ['login', 'onboarding', 'home', 'workout', 'settings'];

export function resolveRoute(hash: string, state: AppState, authenticated: boolean): ScreenName {
  if (!authenticated) return 'login';
  if (!state.profile) return 'onboarding';

  const requested = hash.replace('#/', '') as ScreenName;
  return KNOWN_SCREENS.includes(requested) ? requested : 'home';
}

export function startRouter(
  container: HTMLElement,
  screens: Record<ScreenName, (container: HTMLElement) => void>,
): void {
  let renderScheduled = false;

  function render(): void {
    const screen = resolveRoute(window.location.hash, getState(), isAuthenticated());
    container.innerHTML = '';
    screens[screen](container);
  }

  function scheduleRender(): void {
    if (!renderScheduled) {
      renderScheduled = true;
      queueMicrotask(() => {
        renderScheduled = false;
        render();
      });
    }
  }

  // Store unsubscribe to prevent listener leaks if startRouter is called multiple times
  // (though in typical single-page app usage, it's only called once at startup)
  void subscribe(scheduleRender);
  void subscribeAuth(scheduleRender);
  window.addEventListener('hashchange', scheduleRender);
  scheduleRender();
}
