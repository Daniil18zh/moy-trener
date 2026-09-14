import './style.css';
import { startRouter } from './router';
import { renderLogin } from './screens/login';
import { renderOnboarding } from './screens/onboarding';
import { renderHome } from './screens/home';
import { renderSettings } from './screens/settings';

function placeholder(name: string) {
  return (container: HTMLElement) => {
    container.innerHTML = `<p>Экран "${name}" ещё не реализован</p>`;
  };
}

const container = document.querySelector<HTMLDivElement>('#app')!;
startRouter(container, {
  login: renderLogin,
  onboarding: renderOnboarding,
  home: renderHome,
  workout: placeholder('workout'),
  settings: renderSettings,
});
