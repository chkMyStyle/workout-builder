// Схемы нагрузки v1.1. Производные данные: библиотека и сохранения не изменяются.
(function () {
  "use strict";

  const PULLUP_IDS = Object.freeze(["ex019", "ex020", "ex021", "ex022"]);
  const PUSHUP_IDS = Object.freeze(["ex035", "ex036", "ex037", "ex038"]);
  const BODYWEIGHT_IDS = Object.freeze([...PULLUP_IDS, ...PUSHUP_IDS]);
  const REST_RECOMMENDATION = "Отдых 60–120 секунд. При необходимости отдыхайте дольше, пока не восстановятся дыхание и готовность к следующему подходу";
  const WORKING_WEIGHT_INSTRUCTION = "Подберите рабочий вес, с которым можете выполнить 12 качественных повторений с запасом примерно 1–2 повторения. В обоих рабочих подходах используйте одинаковый вес.";
  const TECHNICAL_MAXIMUM_INSTRUCTION = "Технический максимум — остановка, когда следующее повторение уже нельзя выполнить с правильной техникой. Разминочные и подводящие подходы не назначаются.";
  const PROGRESSION_STEPS = Object.freeze([
    "Начните с 12–15 повторений в рабочих подходах. Рабочий вес должен позволять выполнить 12 качественных повторений с запасом примерно 1–2 повторения.",
    "Используйте одинаковый вес в обоих рабочих подходах и постепенно увеличивайте число повторений, сохраняя технику.",
    "Когда в обоих рабочих подходах достигнуты 15 повторений с запасом примерно 1–2 повторения, повысьте вес.",
    "После повышения веса вернитесь примерно к 12 повторениям.",
    "Если вес оказался слишком тяжёлым, снизьте его. Не выполняйте повторения ценой нарушения техники."
  ]);

  function prescription(kind, scheme, summaryRepetitions, sets, instruction) {
    sets.forEach(Object.freeze);
    return Object.freeze({
      kind, scheme, setCount: sets.length, summaryRepetitions,
      sets: Object.freeze(sets), instruction, rest: REST_RECOMMENDATION
    });
  }

  const main = prescription("main", "2+1+2", "12–15 рабочих повт.", [
    { type: "Разминочный", repetitions: "12", weight: "Лёгкий" },
    { type: "Разминочный", repetitions: "12", weight: "Такой же лёгкий" },
    { type: "Подводящий", repetitions: "12", weight: "Выше разминочного" },
    { type: "Рабочий", repetitions: "12–15", weight: "Рабочий" },
    { type: "Рабочий", repetitions: "12–15", weight: "Такой же рабочий" }
  ], WORKING_WEIGHT_INSTRUCTION);

  const accessory = prescription("accessory", "2+2", "12–15 рабочих повт.", [
    { type: "Разминочный", repetitions: "12", weight: "Лёгкий" },
    { type: "Разминочный", repetitions: "12", weight: "Такой же лёгкий" },
    { type: "Рабочий", repetitions: "12–15", weight: "Рабочий" },
    { type: "Рабочий", repetitions: "12–15", weight: "Такой же рабочий" }
  ], WORKING_WEIGHT_INSTRUCTION);

  const pullup = prescription("bodyweight", "5×12", "12 повторений", Array.from({ length: 5 }, () => ({
    type: "С собственным весом", repetitions: "12", weight: null
  })), "Если 12 повторений пока не получается, используйте облегчённую вариацию: гравитрон с тем же выбранным хватом.");

  const pushup = prescription("bodyweight", "5×12", "12 повторений", Array.from({ length: 5 }, () => ({
    type: "С собственным весом", repetitions: "12", weight: null
  })), "Если 12 повторений пока не получается, используйте облегчённую вариацию отжиманий: с высокой опоры или с колен.");

  const core = prescription("core", "3×макс.", "до технического максимума", Array.from({ length: 3 }, () => ({
    type: "До технического максимума", repetitions: "макс.", weight: null
  })), TECHNICAL_MAXIMUM_INSTRUCTION);

  function diagnostic(exercise, reason) {
    const name = typeof exercise?.name === "string" ? exercise.name : "Упражнение";
    const id = typeof exercise?.id === "string" ? exercise.id : "без ID";
    return new Error(`Не удалось определить схему нагрузки для «${name}» (${id}): ${reason}.`);
  }

  function getPrescription(exercise) {
    if (!exercise || typeof exercise !== "object" || typeof exercise.id !== "string" || !exercise.id) {
      throw diagnostic(exercise, "не указан корректный ID упражнения");
    }
    if (typeof exercise.category !== "string" || !exercise.category.trim()) {
      throw diagnostic(exercise, "не указана группа мышц");
    }
    // The priority is intentional: muscle group, explicit bodyweight IDs, role.
    if (exercise.category === "Мышцы корпуса") return core;
    if (PULLUP_IDS.includes(exercise.id)) return pullup;
    if (PUSHUP_IDS.includes(exercise.id)) return pushup;
    if (exercise.role === "Основное") return main;
    if (exercise.role === "Вспомогательное") return accessory;
    throw diagnostic(exercise, "неизвестная роль упражнения; ожидается «Основное» или «Вспомогательное»");
  }

  window.WorkoutLoad = Object.freeze({
    PULLUP_IDS, PUSHUP_IDS, BODYWEIGHT_IDS, REST_RECOMMENDATION,
    PROGRESSION_STEPS, getPrescription
  });
})();
