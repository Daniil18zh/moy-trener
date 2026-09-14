import './style.css';
import { startRouter } from './router';
import { renderLogin } from './screens/login';
import { renderOnboarding } from './screens/onboarding';
import { renderHome } from './screens/home';
import { renderWorkout } from './screens/workout';
import { renderSettings } from './screens/settings';

const container = document.querySelector<HTMLDivElement>('#app')!;
startRouter(container, {
  login: renderLogin,
  onboarding: renderOnboarding,
  home: renderHome,
  workout: renderWorkout,
  settings: renderSettings,
});
