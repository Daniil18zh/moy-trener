import type { AppState } from './types';
import { getState, subscribe } from './state';

export type ScreenName = 'login' | 'onboarding' | 'home' | 'workout' | 'settings';

const KNOWN_SCREENS: ScreenName[] = ['login', 'onboarding', 'home', 'workout', 'settings'];

export function resolveRoute(hash: string, state: AppState): ScreenName {
  if (!state.auth) return 'login';
  if (!state.profile) return 'onboarding';

  const requested = hash.replace('#/', '') as ScreenName;
  return KNOWN_SCREENS.includes(requested) ? requested : 'home';
}

export function startRouter(
  container: HTMLElement,
  screens: Record<ScreenName, (container: HTMLElement) => void>,
): void {
  function render(): void {
    const screen = resolveRoute(window.location.hash, getState());
    container.innerHTML = '';
    screens[screen](container);
  }

  window.addEventListener('hashchange', render);
  subscribe(render);
  render();
}
