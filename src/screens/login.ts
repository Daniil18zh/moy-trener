import { ensureDefaultAuth, verifyLogin } from '../auth';
import { markAuthenticated } from '../sessionAuth';

export function renderLogin(container: HTMLElement): void {
  void ensureDefaultAuth();

  container.innerHTML = `
    <h1>Мой тренер</h1>
    <form id="login-form">
      <label for="login">Логин</label>
      <input id="login" name="login" type="text" autocomplete="username" required />
      <label for="password">Пароль</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <p id="login-error" style="color: var(--danger); display: none;">Неверный логин или пароль</p>
      <button type="submit" style="width: 100%; margin-top: 16px;">Войти</button>
      <p style="font-size: 0.85rem; color: #666; margin-top: 24px;">
        Это локальная защита уровня браузера, а не полноценная аутентификация —
        при просмотре исходного кода страницы её можно обойти.
      </p>
    </form>
  `;

  const form = container.querySelector<HTMLFormElement>('#login-form')!;
  const errorEl = container.querySelector<HTMLParagraphElement>('#login-error')!;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const login = (container.querySelector('#login') as HTMLInputElement).value;
    const password = (container.querySelector('#password') as HTMLInputElement).value;

    if (await verifyLogin(login, password)) {
      errorEl.style.display = 'none';
      markAuthenticated();
      window.location.hash = '#/home';
    } else {
      errorEl.style.display = 'block';
    }
  });
}
