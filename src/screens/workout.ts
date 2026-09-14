import type { Exercise, SetLogEntry, WorkoutLog } from '../types';
import { getState, updateState } from '../state';
import { loadExercises } from '../exercises/loader';
import { advanceWeek } from '../program/generator';
import { createCountdown, playBeep, type Countdown } from '../timer';

// Module-level session state, deliberately kept OUTSIDE renderWorkout(). The router
// (src/router.ts) subscribes to state changes and reactively re-invokes renderWorkout() for the
// current hash whenever updateState() fires — and several actions on this screen (finishing the
// workout, replacing an exercise) call updateState() while still on "#/workout". Each such call
// spawns a brand-new renderWorkout() closure. If the in-progress set logs, session start time, the
// session-timer interval, and the active rest countdown lived only as local variables inside that
// closure, a reactive remount would silently reset all of them: already-marked "Готово" sets would
// vanish from the eventual WorkoutLog, the elapsed-time clock would restart, a new session-timer
// interval would stack on top of any previous one (never cleared), and any rest countdown from the
// old closure would keep ticking against detached DOM nodes (still audible via playBeep(), just
// invisible). Hoisting this state to module scope means every renderWorkout() invocation for the
// same in-progress session reads and writes the *same* underlying state, so a reactive remount is
// transparent — it only gets reset once the workout actually finishes (see finishWorkout()).
let sessionLogs: Map<string, SetLogEntry> = new Map();
let sessionStartedAt: number | null = null;
let sessionTimerIntervalId: ReturnType<typeof setInterval> | null = null;
let sessionRestCountdown: Countdown | null = null;

// Set by finishWorkout() right before it persists state, consumed by the very next call to
// renderWorkout(). This exists because the same reactive-remount mechanism described above would
// otherwise replace the just-finished summary with a fresh render of the *next* day's workout
// before the user ever saw it. Checking this flag at the top of renderWorkout, before any other
// work, guarantees the summary wins regardless of how many microtask hops the reactive re-render
// takes (e.g. through loadExercises().then(...)).
let pendingSummary: { durationMin: number; totalTonnageKg: number } | null = null;

function renderSummary(container: HTMLElement, summary: { durationMin: number; totalTonnageKg: number }): void {
  container.innerHTML = `
    <h1>Тренировка завершена</h1>
    <p>Время: ${summary.durationMin} мин</p>
    <p>Тоннаж: ${Math.round(summary.totalTonnageKg)} кг</p>
    <button id="back-home" style="width: 100%;">На главную</button>
  `;
  container.querySelector('#back-home')!.addEventListener('click', () => { window.location.hash = '#/home'; });
}

export function renderWorkout(container: HTMLElement): void {
  if (pendingSummary) {
    renderSummary(container, pendingSummary);
    pendingSummary = null;
    return;
  }

  const { program, exerciseLog } = getState();
  if (!program) {
    container.innerHTML = '<p>Программа не найдена.</p>';
    return;
  }

  const dayIndex = exerciseLog.length % program.days.length;
  const day = program.days[dayIndex];

  // Only start a fresh session (start time + set logs) the first time we render for this
  // workout; a reactive remount mid-session (e.g. triggered by "Заменить") must reuse the same
  // session state rather than resetting it. finishWorkout() sets sessionStartedAt back to null
  // once the workout is actually over, so the *next* workout correctly starts a new session.
  if (sessionStartedAt === null) {
    sessionStartedAt = Date.now();
    sessionLogs = new Map();
  }
  const startedAt = sessionStartedAt;
  // Working copy of set logs, keyed by "exerciseId:setIndex"
  const logs = sessionLogs;
  let allExercisesCache: Exercise[] = [];

  loadExercises().then((allExercises) => {
    allExercisesCache = allExercises;
    const byId = new Map(allExercises.map((e) => [e.id, e]));
    renderScreen(byId);
  });

  function findReplacement(currentId: string, byId: Map<string, Exercise>): Exercise | null {
    const current = byId.get(currentId);
    const { profile } = getState();
    if (!current || !profile) return null;
    const usedIds = new Set(day.exercises.map((e) => e.exerciseId));
    return (
      allExercisesCache.find(
        (e) => e.id !== currentId && !usedIds.has(e.id) && e.muscleGroup === current.muscleGroup && e.equipmentTiers.includes(profile.equipment),
      ) ?? null
    );
  }

  function renderScreen(byId: Map<string, Exercise>): void {
    container.innerHTML = `
      <h1>Тренировка</h1>
      <p id="session-timer">Прошло: 0 мин</p>
      <div id="exercise-list"></div>
      <div id="rest-timer" style="display: none; text-align: center; margin: 16px 0;">
        <p>Отдых: <span id="rest-remaining"></span> сек</p>
        <button id="rest-minus" class="secondary">-15 сек</button>
        <button id="rest-plus" class="secondary">+15 сек</button>
      </div>
      <button id="finish-workout" style="width: 100%; margin-top: 16px;">Завершить тренировку</button>
    `;

    const list = container.querySelector<HTMLDivElement>('#exercise-list')!;
    for (const ex of day.exercises) {
      const exercise = byId.get(ex.exerciseId);
      const wrapper = document.createElement('section');
      wrapper.style.cssText = 'border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 12px;';
      wrapper.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <h3 style="margin: 0;">${exercise?.nameRu ?? ex.exerciseId}</h3>
          <button class="replace-btn secondary" style="font-size: 0.8rem; padding: 4px 8px; min-height: 32px;">Заменить</button>
        </div>
        ${exercise?.images[0] ? `<img src="/exercises/${exercise.id}/${exercise.images[0].split('/').pop()}" alt="${exercise.nameRu}" style="max-width: 100%; border-radius: 8px;" />` : ''}
        <p>${ex.sets} × ${ex.repsMin}-${ex.repsMax} ${ex.targetWeightKg !== null ? `@ ${ex.targetWeightKg} кг` : '(вес тела)'}</p>
        <div class="set-rows"></div>
      `;

      wrapper.querySelector('.replace-btn')!.addEventListener('click', () => {
        const replacement = findReplacement(ex.exerciseId, byId);
        if (!replacement) {
          window.alert('Аналог не найден среди доступных упражнений');
          return;
        }
        const { program: currentProgram } = getState();
        if (!currentProgram) return;
        const updatedDays = currentProgram.days.map((d, idx) =>
          idx === dayIndex
            ? { ...d, exercises: d.exercises.map((e) => (e.exerciseId === ex.exerciseId ? { ...e, exerciseId: replacement.id } : e)) }
            : d,
        );
        updateState('program', { ...currentProgram, days: updatedDays });
        day.exercises = updatedDays[dayIndex].exercises; // keep this render's local `day` reference in sync
        renderScreen(byId); // re-render with the swapped exercise; in-progress set logs for the swapped exercise are cleared, matching "replace before you start it" usage
      });

      const setRows = wrapper.querySelector<HTMLDivElement>('.set-rows')!;
      for (let setIndex = 0; setIndex < ex.sets; setIndex++) {
        const row = document.createElement('div');
        row.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 8px;';
        row.innerHTML = `
          <input class="actual-weight" type="number" value="${ex.targetWeightKg ?? ''}" placeholder="кг" style="width: 80px;" />
          <input class="actual-reps" type="number" value="${ex.repsMin}" placeholder="повторы" style="width: 80px;" />
          <button class="done-btn secondary">Готово ✓</button>
        `;
        const doneBtn = row.querySelector<HTMLButtonElement>('.done-btn')!;
        doneBtn.addEventListener('click', () => {
          const weightInput = row.querySelector<HTMLInputElement>('.actual-weight')!;
          const repsInput = row.querySelector<HTMLInputElement>('.actual-reps')!;
          logs.set(`${ex.exerciseId}:${setIndex}`, {
            planned: { weightKg: ex.targetWeightKg, reps: ex.repsMin },
            actual: { weightKg: weightInput.value ? Number(weightInput.value) : null, reps: Number(repsInput.value) },
            done: true,
          });
          doneBtn.textContent = 'Выполнено';
          doneBtn.disabled = true;
          startRest(ex.restSec);
        });
        setRows.appendChild(row);
      }
      list.appendChild(wrapper);
    }

    const sessionTimerEl = container.querySelector<HTMLParagraphElement>('#session-timer')!;
    if (sessionTimerIntervalId !== null) clearInterval(sessionTimerIntervalId);
    sessionTimerIntervalId = setInterval(() => {
      const elapsedMin = Math.floor((Date.now() - startedAt) / 60000);
      sessionTimerEl.textContent = `Прошло: ${elapsedMin} мин`;
    }, 15000);

    container.querySelector('#finish-workout')!.addEventListener('click', () => finishWorkout());
  }

  function startRest(restSec: number): void {
    sessionRestCountdown?.stop();
    const restEl = container.querySelector<HTMLDivElement>('#rest-timer')!;
    const remainingEl = container.querySelector<HTMLSpanElement>('#rest-remaining')!;
    restEl.style.display = 'block';
    remainingEl.textContent = String(restSec);

    sessionRestCountdown = createCountdown(
      restSec,
      (remaining) => { remainingEl.textContent = String(remaining); },
      () => { playBeep(); restEl.style.display = 'none'; },
    );

    container.querySelector('#rest-minus')!.addEventListener('click', () => sessionRestCountdown?.addSeconds(-15));
    container.querySelector('#rest-plus')!.addEventListener('click', () => sessionRestCountdown?.addSeconds(15));
  }

  function finishWorkout(): void {
    const durationMin = Math.round((Date.now() - startedAt) / 60000);
    let totalTonnageKg = 0;
    const exercisesLog: WorkoutLog['exercises'] = day.exercises.map((ex) => {
      const sets: SetLogEntry[] = [];
      for (let setIndex = 0; setIndex < ex.sets; setIndex++) {
        const entry = logs.get(`${ex.exerciseId}:${setIndex}`);
        if (entry) {
          sets.push(entry);
          if (entry.actual.weightKg) totalTonnageKg += entry.actual.weightKg * entry.actual.reps;
        }
      }
      return { exerciseId: ex.exerciseId, sets };
    });

    const log: WorkoutLog = { date: new Date().toISOString(), dayIndex, exercises: exercisesLog, durationMin, totalTonnageKg };
    const { exerciseLog: currentLog, program: currentProgram, profile } = getState();

    // Reset session state so the *next* workout starts fresh, and stop any still-running rest
    // countdown so it can't fire playBeep() against a now-irrelevant session.
    sessionStartedAt = null;
    sessionLogs = new Map();
    if (sessionTimerIntervalId !== null) {
      clearInterval(sessionTimerIntervalId);
      sessionTimerIntervalId = null;
    }
    sessionRestCountdown?.stop();
    sessionRestCountdown = null;

    // Set before updateState() so the reactive re-render it triggers (see the comment on
    // pendingSummary above) shows this summary instead of starting the next day.
    pendingSummary = { durationMin, totalTonnageKg };

    updateState('exerciseLog', [...currentLog, log]);

    // Advance the week once every day in the split has been logged since the last advance.
    const logsSinceProgramStart = currentLog.length + 1;
    if (currentProgram && profile && logsSinceProgramStart % currentProgram.days.length === 0) {
      const weekLogs = [...currentLog, log].slice(-currentProgram.days.length);
      const { program: updatedProgram, experience: updatedExperience } = advanceWeek(currentProgram, profile, weekLogs);
      updateState('program', updatedProgram);
      if (updatedExperience !== profile.experience) {
        updateState('profile', { ...profile, experience: updatedExperience });
      }
    }

    // No direct renderSummary() call here: the updateState() call above always triggers the
    // router's reactive re-render (it subscribes to every state change), which will invoke
    // renderWorkout() again and immediately hit the pendingSummary guard at the top of this
    // function — that's what actually paints the summary.
  }
}
