"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = vm.createContext({ window: {} });
for (const file of ["exercises.js", "templates.js", "training-load.js", "app.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
}
const { WorkoutCore: core, WorkoutTemplates: templates, WorkoutData: data, WorkoutLoad: load } = context.window;
const plain = value => JSON.parse(JSON.stringify(value));
const get = id => load.getPrescription(data.exerciseById[id]);

test("main exercises have exactly two warmup, one lead-in and two working sets", () => {
  const result = get("ex001");
  assert.equal(result.scheme, "2+1+2");
  assert.equal(result.setCount, 5);
  assert.deepEqual(plain(result.sets), [
    { type: "Разминочный", repetitions: "12", weight: "Лёгкий" },
    { type: "Разминочный", repetitions: "12", weight: "Такой же лёгкий" },
    { type: "Подводящий", repetitions: "12", weight: "Выше разминочного" },
    { type: "Рабочий", repetitions: "12–15", weight: "Рабочий" },
    { type: "Рабочий", repetitions: "12–15", weight: "Такой же рабочий" }
  ]);
  assert.match(result.instruction, /12 качественных повторений/);
  assert.match(result.instruction, /1–2 повторения/);
  assert.match(result.instruction, /одинаковый вес/);
});

test("accessory exercises have exactly two warmup and two working sets without a lead-in", () => {
  const result = get("ex014");
  assert.equal(result.scheme, "2+2");
  assert.equal(result.setCount, 4);
  assert.deepEqual(plain(result.sets), [
    { type: "Разминочный", repetitions: "12", weight: "Лёгкий" },
    { type: "Разминочный", repetitions: "12", weight: "Такой же лёгкий" },
    { type: "Рабочий", repetitions: "12–15", weight: "Рабочий" },
    { type: "Рабочий", repetitions: "12–15", weight: "Такой же рабочий" }
  ]);
});

test("all four canonical pullup IDs get 5×12 and assistance preserves the grip", () => {
  assert.deepEqual(plain(load.PULLUP_IDS), ["ex019", "ex020", "ex021", "ex022"]);
  for (const id of load.PULLUP_IDS) {
    const result = get(id);
    assert.equal(result.scheme, "5×12");
    assert.equal(result.setCount, 5);
    assert.ok(result.sets.every(set => set.repetitions === "12" && set.weight === null));
    assert.match(result.instruction, /гравитрон с тем же выбранным хватом/);
  }
});

test("all pushup IDs, including bench pushups and dips, get 5×12 and lighter-variation guidance", () => {
  assert.deepEqual(plain(load.PUSHUP_IDS), ["ex035", "ex036", "ex037", "ex038"]);
  assert.equal(data.exerciseById.ex038.name, "Отжимания на брусьях");
  for (const id of load.PUSHUP_IDS) {
    const result = get(id);
    assert.equal(result.scheme, "5×12");
    assert.equal(result.setCount, 5);
    assert.ok(result.sets.every(set => set.repetitions === "12" && set.type === "С собственным весом"));
    assert.match(result.instruction, /с высокой опоры или с колен/);
  }
});

test("bodyweight detection uses IDs and has priority over the role", () => {
  assert.equal(load.getPrescription({ ...data.exerciseById.ex019, name: "Другое отображаемое название", role: "Вспомогательное" }).scheme, "5×12");
  assert.equal(load.getPrescription({ ...data.exerciseById.ex035, role: "Неизвестно" }).scheme, "5×12");
  assert.equal(load.getPrescription({ ...data.exerciseById.ex001, name: "Подтягивания" }).scheme, "2+1+2");
});

test("all four core exercises get three technical-maximum sets with no warmups", () => {
  for (const id of ["ex055", "ex056", "ex057", "ex058"]) {
    const result = get(id);
    assert.equal(result.scheme, "3×макс.");
    assert.equal(result.setCount, 3);
    assert.equal(result.summaryRepetitions, "до технического максимума");
    assert.ok(result.sets.every(set => set.type === "До технического максимума" && set.weight === null));
    assert.match(result.instruction, /правильной техникой/);
    assert.match(result.instruction, /Разминочные и подводящие подходы не назначаются/);
  }
});

test("core group takes priority over both the main role and a bodyweight ID", () => {
  assert.equal(load.getPrescription({ ...data.exerciseById.ex055, role: "Основное" }).scheme, "3×макс.");
  assert.equal(load.getPrescription({ ...data.exerciseById.ex019, category: "Мышцы корпуса" }).scheme, "3×макс.");
});

test("every one of the 58 exercises has a valid immutable prescription and the exact rest recommendation", () => {
  const counts = {};
  for (const exercise of data.exercises) {
    const result = get(exercise.id);
    assert.equal(result.rest, "Отдых 60–120 секунд. При необходимости отдыхайте дольше, пока не восстановятся дыхание и готовность к следующему подходу");
    assert.equal(result.setCount, result.sets.length);
    assert.ok(Object.isFrozen(result) && Object.isFrozen(result.sets));
    assert.ok(result.sets.every(Object.isFrozen));
    counts[result.kind] = (counts[result.kind] || 0) + 1;
  }
  assert.deepEqual(counts, { main: 29, accessory: 17, bodyweight: 8, core: 4 });
});

test("incomplete metadata produces a readable diagnostic instead of a fallback scheme", () => {
  for (const exercise of [undefined, null, {}, { id: "ex001" }, { ...data.exerciseById.ex001, role: "Неизвестно" }]) {
    assert.throws(() => load.getPrescription(exercise), /Не удалось определить схему нагрузки/);
  }
  assert.throws(() => load.getPrescription({ ...data.exerciseById.ex001, role: null }), /ex001.*неизвестная роль/);
});

test("a permitted weighted-to-bodyweight replacement updates only that position's prescription", () => {
  const template = templates[1];
  const before = core.createDefaults(template);
  const after = core.replaceExercise(template, before, "block2-position2", "ex035");
  assert.equal(get(before["block2-position2"]).scheme, "2+1+2");
  assert.equal(get(after["block2-position2"]).scheme, "5×12");
  for (const position of template.positions) if (position.positionId !== "block2-position2") {
    assert.equal(after[position.positionId], before[position.positionId]);
    assert.equal(get(after[position.positionId]), get(before[position.positionId]));
  }
  assert.ok(core.isValidSelection(template, after));
  assert.equal(new Set(Object.values(after)).size, 6);
});

test("v1 saves remain compatible; load is derived on restore without new saved parameters", () => {
  const saved = core.defaultState();
  saved.activeBlockId = "block2";
  saved.blocks.block2["block2-position2"] = "ex035";
  const snapshot = JSON.stringify(saved);
  const restored = core.restoreState(snapshot);
  assert.equal(restored.repaired, false);
  assert.equal(JSON.stringify(restored.state), snapshot);
  assert.equal(get(restored.state.blocks.block2["block2-position2"]).scheme, "5×12");
  assert.equal(core.STORAGE_KEY, "strength-workout-builder:v1");
  assert.equal(core.SCHEMA_VERSION, 1);
});

test("double progression is instruction-only and includes both working sets, reserve and reducing load", () => {
  const instruction = load.PROGRESSION_STEPS.join(" ");
  assert.match(instruction, /12–15/);
  assert.match(instruction, /одинаковый вес в обоих рабочих подходах/);
  assert.match(instruction, /обоих рабочих подходах достигнуты 15 повторений с запасом примерно 1–2/);
  assert.match(instruction, /повышения веса вернитесь примерно к 12/);
  assert.match(instruction, /снизьте его/);
  assert.doesNotMatch(instruction, /\b\d+\s*(кг|%)/);
});
