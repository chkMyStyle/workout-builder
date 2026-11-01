(function () {
  "use strict";

  const templates = window.WorkoutTemplates;
  const { exerciseById } = window.WorkoutData;
  const STORAGE_KEY = "strength-workout-builder:v1";
  const SCHEMA_VERSION = 1;

  function createDefaults(template) {
    return Object.fromEntries(template.positions.map(position => [position.positionId, position.defaultExerciseId]));
  }

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function isValidSelection(template, selection) {
    if (!isRecord(selection) || Object.keys(selection).length !== template.positions.length) return false;
    const seen = new Set();
    return template.positions.every(position => {
      const id = selection[position.positionId];
      if (typeof id !== "string" || !Object.hasOwn(selection, position.positionId) || !Object.hasOwn(exerciseById, id)
        || !position.allowedExerciseIds.includes(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function availableExercises(template, selection, positionId) {
    const position = template.positions.find(item => item.positionId === positionId);
    if (!position) return [];
    const usedElsewhere = new Set(template.positions
      .filter(item => item.positionId !== positionId)
      .map(item => selection[item.positionId]));
    return position.allowedExerciseIds.filter(id => Object.hasOwn(exerciseById, id) && !usedElsewhere.has(id));
  }

  function replaceExercise(template, selection, positionId, exerciseId) {
    if (!isValidSelection(template, selection)
      || !availableExercises(template, selection, positionId).includes(exerciseId)) return null;
    return { ...selection, [positionId]: exerciseId };
  }

  function defaultState() {
    return {
      version: SCHEMA_VERSION,
      activeBlockId: templates[0].id,
      blocks: Object.fromEntries(templates.map(template => [template.id, createDefaults(template)]))
    };
  }

  // A damaged block is reset as a whole: this also resolves conflicts with defaults.
  // Valid blocks are independent and keep their own saved choices.
  function restoreState(raw) {
    const state = defaultState();
    if (raw === null) return { state, repaired: false };
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return { state, repaired: true }; }
    if (!isRecord(parsed) || parsed.version !== SCHEMA_VERSION || !isRecord(parsed.blocks)) {
      return { state, repaired: true };
    }
    let repaired = false;
    if (templates.some(template => template.id === parsed.activeBlockId)) state.activeBlockId = parsed.activeBlockId;
    else repaired = true;
    for (const template of templates) {
      if (isValidSelection(template, parsed.blocks[template.id])) {
        state.blocks[template.id] = { ...parsed.blocks[template.id] };
      } else repaired = true;
    }
    return { state, repaired };
  }

  // Pure validation functions are also used by the optional Node.js checks.
  window.WorkoutCore = Object.freeze({
    STORAGE_KEY, SCHEMA_VERSION, createDefaults, isValidSelection,
    availableExercises, replaceExercise, defaultState, restoreState
  });

  if (typeof document === "undefined") return;

  const byId = id => document.getElementById(id);
  const list = byId("exercise-list");
  const tabs = byId("block-tabs");
  const dialog = byId("replacement-dialog");
  let storageAvailable = true;
  let recoveryNotice = "";
  let state;
  let returnFocusPositionId = null;

  try {
    const restored = restoreState(window.localStorage.getItem(STORAGE_KEY));
    state = restored.state;
    if (restored.repaired) recoveryNotice = "Некорректные сохранения восстановлены: затронутые блоки возвращены к исходному составу.";
  } catch {
    state = defaultState();
    storageAvailable = false;
  }

  function icon(name, extraClass = "") {
    return `<svg class="icon ${extraClass}" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function activeTemplate() {
    return templates.find(template => template.id === state.activeBlockId);
  }

  function announce(message) {
    byId("announcement").textContent = "";
    window.setTimeout(() => { byId("announcement").textContent = message; }, 30);
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
  }

  function renderTabs() {
    tabs.innerHTML = templates.map(template => {
      const selected = template.id === state.activeBlockId;
      return `<button class="block-tab" id="tab-${template.id}" type="button" role="tab"
        aria-selected="${selected}" aria-controls="workout-panel" tabindex="${selected ? "0" : "-1"}"
        data-block-id="${template.id}"><span class="tab-number">0${template.number}</span>
        <span class="tab-copy"><span class="tab-kicker">Тренировка ${template.number}</span><span class="tab-name">${escapeHtml(template.name)}</span></span>${icon("arrow", "tab-arrow")}</button>`;
    }).join("");
  }

  function renderLoad(exercise, expanded) {
    try {
      if (!window.WorkoutLoad) throw new Error("Не загружен файл training-load.js. Проверьте, что все файлы приложения находятся рядом.");
      const load = window.WorkoutLoad.getPrescription(exercise);
      const setWord = load.setCount === 3 ? "подхода" : "подходов";
      const sets = load.sets.map((set, index) => `<li class="set-row">
        <span class="set-number" aria-hidden="true">${index + 1}</span>
        <span class="set-purpose"><span class="set-type">${escapeHtml(set.type)}</span>${set.weight ? `<span class="set-weight">Вес: ${escapeHtml(set.weight)}</span>` : ""}</span>
        <span class="set-repetitions">${escapeHtml(set.repetitions)}<span>${load.kind === "core" ? "" : "повт."}</span></span></li>`).join("");
      return `<div class="load-summary" data-load-kind="${load.kind}" data-load-scheme="${load.scheme}">
        <span class="load-badge">${load.scheme}</span><span>${load.setCount} ${setWord}</span><span>${escapeHtml(load.summaryRepetitions)}</span></div>
        <details class="load-details"${expanded ? " open" : ""}><summary><span>Подробнее о подходах</span>${icon("arrow", "details-arrow")}</summary>
          <div class="load-details-content"><ol class="set-list" aria-label="Подходы: ${escapeHtml(exercise.name)}">${sets}</ol><p class="load-instruction">${escapeHtml(load.instruction)}</p></div>
        </details>`;
    } catch (error) {
      return `<p class="load-error" role="alert">${escapeHtml(error.message)}</p>`;
    }
  }

  function renderExercise(template, selection, position, index, expanded) {
    const exercise = exerciseById[selection[position.positionId]];
    const changed = exercise.id !== position.defaultExerciseId;
    const isLegCurl = template.id === "block3" && position.positionId === "block3-position4";
    let control;
    if (isLegCurl) {
      control = `<select class="curl-select" data-position-id="${position.positionId}" aria-label="Вариант сгибания ног, позиция 4">${availableExercises(template, selection, position.positionId).map(id =>
        `<option value="${id}"${id === exercise.id ? " selected" : ""}>${id === "ex015" ? "Сидя" : "Лёжа"}</option>`).join("")}</select>`;
    } else if (position.allowedExerciseIds.length > 1) {
      control = `<button class="replace-button" type="button" data-position-id="${position.positionId}" aria-label="Заменить: ${escapeHtml(exercise.name)}" aria-haspopup="dialog">${icon("swap")}<span class="replace-label">Заменить</span></button>`;
    } else {
      control = `<span class="fixed-label" title="Фиксированная позиция — замены не предусмотрены">${icon("lock")}<span>Без замены</span></span>`;
    }
    return `<li class="exercise-row${isLegCurl ? " has-select" : ""}" data-position-id="${position.positionId}" data-exercise-id="${exercise.id}">
      <span class="exercise-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <div class="exercise-body">${changed ? '<span class="changed-label">Замена</span>' : ""}<h3 class="exercise-title">${escapeHtml(exercise.name)}</h3><p class="muscles">${escapeHtml(exercise.primaryMuscles)}</p>${renderLoad(exercise, expanded)}</div>
      <div class="exercise-control">${control}</div></li>`;
  }

  function render() {
    const template = activeTemplate();
    const selection = state.blocks[template.id];
    renderTabs();
    byId("workout-panel").setAttribute("aria-labelledby", `tab-${template.id}`);
    byId("block-label").textContent = `ТРЕНИРОВКА ${String(template.number).padStart(2, "0")} / 04`;
    byId("workout-title").textContent = template.name;
    byId("workout-focus").innerHTML = `Акцент: <strong>${escapeHtml(template.focus)}</strong>`;
    const expandedPositions = new Set([...list.querySelectorAll(".load-details[open]")].map(details => details.closest(".exercise-row").dataset.positionId));
    list.innerHTML = template.positions.map((position, index) => renderExercise(template, selection, position, index, expandedPositions.has(position.positionId))).join("");
    const changeCount = template.positions.filter(position => selection[position.positionId] !== position.defaultExerciseId).length;
    byId("change-count").textContent = changeCount === 0 ? "Исходный состав" : `${changeCount} ${changeCount === 1 ? "замена" : changeCount < 5 ? "замены" : "замен"}`;
    byId("reset-workout").disabled = changeCount === 0;
    byId("save-status").innerHTML = `${icon(storageAvailable ? "check" : "lock")}<span>${storageAvailable ? "Сохранено на устройстве" : "Сохранение недоступно"}</span>`;
    const warning = byId("storage-warning");
    warning.textContent = storageAvailable ? recoveryNotice : "Браузер запретил сохранение. Изменения действуют до обновления или закрытия страницы.";
    warning.hidden = !warning.textContent;
    byId("cycle-track").innerHTML = templates.map((item, index) => `${index > 0 ? '<span class="track-connector"></span>' : ""}<span class="track-node${item.id === template.id ? " is-active" : ""}">${String(item.number).padStart(2, "0")}</span>`).join("");
    byId("cycle-caption").textContent = `Сейчас выбран блок ${template.number} из 4`;
  }

  function selectBlock(blockId, focus = false) {
    if (!templates.some(template => template.id === blockId)) return;
    state.activeBlockId = blockId;
    persist();
    render();
    if (focus) byId(`tab-${blockId}`).focus();
  }

  function openReplacement(positionId) {
    const template = activeTemplate();
    const position = template.positions.find(item => item.positionId === positionId);
    if (!position || position.allowedExerciseIds.length <= 1) return;
    const selection = state.blocks[template.id];
    const current = selection[positionId];
    returnFocusPositionId = positionId;
    byId("replacement-kicker").textContent = `ТРЕНИРОВКА ${template.number} · ПОЗИЦИЯ ${template.positions.indexOf(position) + 1}`;
    byId("replacement-options").innerHTML = availableExercises(template, selection, positionId).map(id => {
      const exercise = exerciseById[id];
      const selected = id === current;
      const original = id === position.defaultExerciseId;
      return `<button class="option-button${selected ? " is-selected" : ""}" type="button" data-exercise-id="${id}"${selected ? ' disabled aria-current="true"' : ""}>
        <span><span class="option-title">${escapeHtml(exercise.name)}</span><span class="option-muscles">${escapeHtml(exercise.primaryMuscles)}</span>
        ${selected || original ? `<span class="option-tag">${selected ? "Сейчас в тренировке" : ""}${selected && original ? " · " : ""}${original ? "Исходное упражнение" : ""}</span>` : ""}</span>${icon(selected ? "check" : "arrow")}</button>`;
    }).join("");
    dialog.showModal();
    document.body.classList.add("dialog-open");
  }

  function applyReplacement(positionId, exerciseId) {
    const template = activeTemplate();
    const updated = replaceExercise(template, state.blocks[template.id], positionId, exerciseId);
    if (!updated) {
      announce("Это упражнение недоступно для этой позиции или уже используется в тренировке.");
      return false;
    }
    state.blocks[template.id] = updated;
    recoveryNotice = "";
    persist();
    render();
    announce(`Выбрано: ${exerciseById[exerciseId].name}. ${storageAvailable ? "Сохранено на устройстве." : "Сохранение недоступно."}`);
    return true;
  }

  tabs.addEventListener("click", event => {
    const button = event.target.closest("[data-block-id]");
    if (button) selectBlock(button.dataset.blockId, true);
  });

  tabs.addEventListener("keydown", event => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    let index = templates.findIndex(template => template.id === state.activeBlockId);
    if (event.key === "ArrowRight") index = (index + 1) % templates.length;
    if (event.key === "ArrowLeft") index = (index + templates.length - 1) % templates.length;
    if (event.key === "Home") index = 0;
    if (event.key === "End") index = templates.length - 1;
    selectBlock(templates[index].id, true);
  });

  list.addEventListener("click", event => {
    const button = event.target.closest("button[data-position-id]");
    if (button) openReplacement(button.dataset.positionId);
  });

  list.addEventListener("change", event => {
    const select = event.target.closest("select[data-position-id]");
    if (!select) return;
    const positionId = select.dataset.positionId;
    if (!applyReplacement(positionId, select.value)) render();
    list.querySelector(`select[data-position-id="${positionId}"]`)?.focus();
  });

  byId("replacement-options").addEventListener("click", event => {
    const button = event.target.closest("button[data-exercise-id]");
    if (button && !button.disabled && applyReplacement(returnFocusPositionId, button.dataset.exerciseId)) dialog.close();
  });

  byId("close-dialog").addEventListener("click", () => dialog.close());
  let backdropPointerDown = false;
  function isOutsideDialog(event) {
    const bounds = dialog.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
  }
  dialog.addEventListener("pointerdown", event => { backdropPointerDown = event.target === dialog && isOutsideDialog(event); });
  dialog.addEventListener("click", event => {
    if (backdropPointerDown && event.target === dialog && isOutsideDialog(event)) dialog.close();
    backdropPointerDown = false;
  });
  dialog.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
    if (returnFocusPositionId) list.querySelector(`button[data-position-id="${returnFocusPositionId}"]`)?.focus();
  });

  byId("reset-workout").addEventListener("click", () => {
    const template = activeTemplate();
    state.blocks[template.id] = createDefaults(template);
    recoveryNotice = "";
    persist();
    render();
    byId(`tab-${template.id}`).focus();
    announce(`Тренировка ${template.number} возвращена к исходному составу. Другие блоки сохранены.`);
  });

  persist();
  if (window.WorkoutLoad) byId("progression-steps").innerHTML = window.WorkoutLoad.PROGRESSION_STEPS.map(step => `<li>${escapeHtml(step)}</li>`).join("");
  render();
})();
