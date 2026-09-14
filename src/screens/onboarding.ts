import type { Equipment, Goal, Profile } from '../types';
import { updateState } from '../state';
import { loadExercises } from '../exercises/loader';
import { generateInitialProgram } from '../program/generator';

const GOAL_LABELS: Record<Goal, string> = {
  mass: 'Набор мышечной массы',
  fatloss: 'Похудение',
  strength: 'Сила',
  fitness: 'Общая физическая форма',
  maintenance: 'Поддержание формы',
};

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  full_gym: 'Полный зал',
  home_dumbbells: 'Дома с гантелями',
  bodyweight: 'Только своё тело',
};

export function renderOnboarding(container: HTMLElement): void {
  container.innerHTML = `
    <h1>Анкета</h1>
    <form id="onboarding-form">
      <label for="heightCm">Рост (см)</label>
      <input id="heightCm" type="number" min="100" max="250" required />

      <label for="weightKg">Вес (кг)</label>
      <input id="weightKg" type="number" min="30" max="300" required />

      <label for="goal">Цель тренировок</label>
      <select id="goal">
        ${Object.entries(GOAL_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
      </select>

      <label for="daysPerWeek">Тренировочных дней в неделю</label>
      <input id="daysPerWeek" type="number" min="2" max="6" value="3" required />

      <label for="sessionDurationMin">Длительность тренировки (мин)</label>
      <input id="sessionDurationMin" type="number" min="20" max="180" value="60" required />

      <label for="equipment">Доступное оборудование</label>
      <select id="equipment">
        ${Object.entries(EQUIPMENT_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
      </select>

      <label for="injuries">Травмы/ограничения (необязательно)</label>
      <input id="injuries" type="text" placeholder="например: колено, поясница" />

      <p id="onboarding-error" style="color: var(--danger); display: none;"></p>

      <button type="submit" style="width: 100%; margin-top: 16px;">Сгенерировать программу</button>
    </form>
  `;

  const form = container.querySelector<HTMLFormElement>('#onboarding-form')!;
  const errorEl = container.querySelector<HTMLParagraphElement>('#onboarding-error')!;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = (id: string) => (container.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement).value;

    const profile: Profile = {
      heightCm: Number(value('heightCm')),
      weightKg: Number(value('weightKg')),
      goal: value('goal') as Goal,
      experience: 'beginner',
      daysPerWeek: Number(value('daysPerWeek')),
      sessionDurationMin: Number(value('sessionDurationMin')),
      equipment: value('equipment') as Equipment,
      preferredStartTimes: {},
      injuries: value('injuries') || undefined,
    };

    try {
      const exercises = await loadExercises();
      const program = generateInitialProgram(profile, exercises);
      updateState('profile', profile);
      updateState('program', program);
      window.location.hash = '#/home';
    } catch (error) {
      errorEl.textContent = 'Не удалось сгенерировать программу. Проверь подключение и попробуй ещё раз.';
      errorEl.style.display = 'block';
    }
  });
}
