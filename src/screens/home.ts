import { getState } from '../state';

export function renderHome(container: HTMLElement): void {
  const { program, exerciseLog } = getState();

  if (!program) {
    container.innerHTML = '<p>Программа не найдена. Пройди анкету заново в настройках.</p>';
    return;
  }

  const nextDayIndex = exerciseLog.length % program.days.length;
  const nextDay = program.days[nextDayIndex];
  const templateLabels: Record<string, string> = {
    full: 'Всё тело', upper: 'Верх тела', lower: 'Низ тела', push: 'Жимовой день', pull: 'Тяговый день', legs: 'Ноги',
  };

  container.innerHTML = `
    <h1>Мой тренер</h1>
    <section style="border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 16px;">
      <h2 style="margin-top: 0;">Ближайшая тренировка</h2>
      <p>${templateLabels[nextDay.template]} · Неделя ${program.currentWeek}</p>
      <button id="start-workout" style="width: 100%;">Начать тренировку</button>
    </section>
    <button id="open-settings" class="secondary" style="width: 100%;">Настройки</button>
  `;

  container.querySelector('#start-workout')!.addEventListener('click', () => {
    window.location.hash = '#/workout';
  });
  container.querySelector('#open-settings')!.addEventListener('click', () => {
    window.location.hash = '#/settings';
  });
}
