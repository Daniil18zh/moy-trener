import './style.css';
import { isStorageAvailable } from './state';
import { startRouter } from './router';
import { renderLogin } from './screens/login';
import { renderOnboarding } from './screens/onboarding';
import { renderHome } from './screens/home';
import { renderWorkout } from './screens/workout';
import { renderSettings } from './screens/settings';

const container = document.querySelector<HTMLDivElement>('#app')!;

// Private browsing and partitioned iframes (the app is embedded in Google Sites) can make
// localStorage throw, in which case everything still works for this session but nothing is kept.
// The banner lives outside #app so the router's innerHTML reset never wipes it.
if (!isStorageAvailable()) {
  const warning = document.createElement('p');
  warning.className = 'storage-warning';
  warning.textContent = 'Хранилище браузера недоступно — данные не будут сохранены между сессиями.';
  container.before(warning);
}

startRouter(container, {
  login: renderLogin,
  onboarding: renderOnboarding,
  home: renderHome,
  workout: renderWorkout,
  settings: renderSettings,
});
