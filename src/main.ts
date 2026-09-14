import './style.css';
import { startRouter } from './router';
import { renderLogin } from './screens/login';
import { renderOnboarding } from './screens/onboarding';

function placeholder(name: string) {
  return (container: HTMLElement) => {
    container.innerHTML = `<p>Экран "${name}" ещё не реализован</p>`;
  };
}

const container = document.querySelector<HTMLDivElement>('#app')!;
startRouter(container, {
  login: renderLogin,
  onboarding: renderOnboarding,
  home: placeholder('home'),
  workout: placeholder('workout'),
  settings: placeholder('settings'),
});
