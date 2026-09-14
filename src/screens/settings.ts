import { changeCredentials } from '../auth';
import { getState, updateState } from '../state';
import { exportAllAsJson, importAllFromJson } from '../exportImport';

let pendingImportStatus: { text: string; color: string } | null = null;

export function renderSettings(container: HTMLElement): void {
  const units = getState().settings.units;

  container.innerHTML = `
    <h1>Настройки</h1>

    <button id="back-home" class="secondary" style="width: 100%;">На главную</button>

    <section>
      <h2>Смена логина/пароля</h2>
      <form id="credentials-form">
        <label for="new-login">Новый логин</label>
        <input id="new-login" type="text" required />
        <label for="new-password">Новый пароль</label>
        <input id="new-password" type="password" minlength="8" required />
        <button type="submit" style="width: 100%; margin-top: 12px;">Сохранить</button>
        <p id="credentials-saved" style="display: none; color: green;">Сохранено</p>
      </form>
    </section>

    <section style="margin-top: 24px;">
      <h2>Единицы измерения</h2>
      <select id="units">
        <option value="metric" ${units === 'metric' ? 'selected' : ''}>Метрические (кг/см)</option>
        <option value="imperial" ${units === 'imperial' ? 'selected' : ''}>Имперские (фунты/дюймы)</option>
      </select>
    </section>

    <section style="margin-top: 24px;">
      <h2>Резервная копия</h2>
      <button id="export-btn" class="secondary" style="width: 100%;">Экспортировать данные в JSON</button>
      <label for="import-file" style="margin-top: 12px;">Импортировать из JSON</label>
      <input id="import-file" type="file" accept="application/json" />
      <p id="import-status"></p>
    </section>

    <section style="margin-top: 24px;">
      <p style="font-size: 0.85rem; color: #666;">
        Для настоящих push-уведомлений открой приложение отдельной вкладкой
        (вне Google Sites) и установи на главный экран.
      </p>
    </section>
  `;

  if (pendingImportStatus) {
    const statusEl = container.querySelector<HTMLParagraphElement>('#import-status')!;
    statusEl.textContent = pendingImportStatus.text;
    statusEl.style.color = pendingImportStatus.color;
    pendingImportStatus = null;
  }

  // Browser-back is awkward inside the Google Sites iframe this app is embedded in, so give the
  // screen an explicit way out.
  container.querySelector('#back-home')!.addEventListener('click', () => {
    window.location.hash = '#/home';
  });

  container.querySelector('#credentials-form')!.addEventListener('submit', async (event) => {
    event.preventDefault();
    const login = (container.querySelector('#new-login') as HTMLInputElement).value;
    const password = (container.querySelector('#new-password') as HTMLInputElement).value;
    await changeCredentials(login, password);
    container.querySelector<HTMLParagraphElement>('#credentials-saved')!.style.display = 'block';
  });

  container.querySelector('#units')!.addEventListener('change', (event) => {
    const value = (event.target as HTMLSelectElement).value as 'metric' | 'imperial';
    updateState('settings', { ...getState().settings, units: value });
  });

  container.querySelector('#export-btn')!.addEventListener('click', () => {
    const blob = new Blob([exportAllAsJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moy-trener-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  container.querySelector('#import-file')!.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (!window.confirm('Импорт полностью заменит текущие данные приложения. Продолжить?')) return;

    const text = await file.text();
    const result = importAllFromJson(text);
    if (result.ok) {
      // updateState already ran inside importAllFromJson, triggering a re-render.
      // Set the pending message so the NEXT render of this screen displays it.
      pendingImportStatus = { text: 'Данные успешно импортированы', color: 'green' };
    } else {
      // No updateState was called, no re-render triggered — safe to update the DOM directly.
      const statusEl = container.querySelector<HTMLParagraphElement>('#import-status')!;
      statusEl.textContent = `Ошибка: ${result.error}`;
      statusEl.style.color = 'var(--danger)';
    }
  });
}
