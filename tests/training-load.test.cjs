"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

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

test("ordinary pushups retain their exact previous 5×12 prescription and assistance guidance", () => {
  assert.deepEqual(plain(load.PUSHUP_IDS), ["ex035", "ex036", "ex037", "ex038", "ex059"]);
  for (const id of ["ex035", "ex036", "ex037"]) {
    const result = get(id);
    assert.equal(result.scheme, "5×12");
    assert.equal(result.setCount, 5);
    assert.ok(result.sets.every(set => set.repetitions === "12" && set.type === "С собственным весом"));
    assert.equal(result.instruction, "Если 12 повторений пока не получается, используйте облегчённую вариацию отжиманий: с высокой опоры или с колен.");
  }
});

test("dips have a distinct 5×12 recommendation with supported dips or pain-free reverse bench pushups", () => {
  const result = get("ex038");
  assert.equal(result.scheme, "5×12");
  assert.equal(result.setCount, 5);
  assert.match(result.instruction, /гравитрон с поддержкой для отжиманий на брусьях, если оборудование позволяет/);
  assert.match(result.instruction, /обратные отжимания от скамьи/);
  assert.match(result.instruction, /без боли и с контролируемой амплитудой/);
  assert.doesNotMatch(result.instruction, /колен|высок.*опор/);
});

test("reverse bench pushups override the accessory role and get 5×12 with safe assistance guidance", () => {
  const result = get("ex059");
  assert.ok(load.BODYWEIGHT_IDS.includes("ex059"));
  assert.equal(new Set(load.BODYWEIGHT_IDS).size, 9);
  assert.equal(result.scheme, "5×12");
  assert.equal(result.setCount, 5);
  assert.ok(result.sets.every(set => set.repetitions === "12" && set.type === "С собственным весом" && set.weight === null));
  assert.match(result.instruction, /более лёгкое положение ног/);
  assert.match(result.instruction, /другой доступный способ облегчения/);
  assert.match(result.instruction, /Не выполняйте упражнение через боль/);
  assert.match(result.instruction, /Не опускайтесь чрезмерно глубоко/);
});

test("prescriptions for all other original exercises are exactly unchanged", () => {
  const originals = data.exercises.filter(exercise => !["ex038", "ex059", "ex060"].includes(exercise.id));
  const values = originals.map(exercise => [exercise.id, load.getPrescription({ ...exercise, unilateral: false })]);
  const digest = crypto.createHash("sha256").update(JSON.stringify(values)).digest("hex");
  assert.equal(digest, "b9cd73abd96003bc6bc7df21f316921b2369bdb6fe2e432a28611cfead0445f8");
});

test("bodyweight detection uses IDs and has priority over the role", () => {
  assert.equal(load.getPrescription({ ...data.exerciseById.ex019, name: "Другое отображаемое название", role: "Вспомогательное" }).scheme, "5×12");
  assert.equal(load.getPrescription({ ...data.exerciseById.ex035, role: "Неизвестно" }).scheme, "5×12");
  assert.equal(load.getPrescription({ ...data.exerciseById.ex001, name: "Подтягивания" }).scheme, "2+1+2");
});

test("all five core exercises including toes-to-bar get three technical-maximum sets with no warmups", () => {
  for (const id of ["ex055", "ex056", "ex057", "ex058", "ex060"]) {
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

test("every one of the 60 exercises has a valid immutable prescription and the exact rest recommendation", () => {
  const counts = {};
  for (const exercise of data.exercises) {
    const result = get(exercise.id);
    assert.equal(result.rest, "Отдых 60–120 секунд. При необходимости отдыхайте дольше, пока не восстановятся дыхание и готовность к следующему подходу");
    assert.equal(result.setCount, result.sets.length);
    assert.ok(Object.isFrozen(result) && Object.isFrozen(result.sets));
    assert.ok(result.sets.every(Object.isFrozen));
    counts[result.kind] = (counts[result.kind] || 0) + 1;
  }
  assert.deepEqual(counts, { main: 29, accessory: 17, bodyweight: 9, core: 5 });
});

test("all unilateral library exercises label every warmup, lead-in and working set per side", () => {
  for (const id of ["ex007", "ex008", "ex009", "ex010", "ex011", "ex025"]) {
    const result = get(id);
    assert.equal(result.scheme, "2+1+2");
    assert.equal(result.setCount, 5);
    assert.match(result.summaryRepetitions, /на каждую сторону$/);
    assert.deepEqual(plain(result.sets.map(set => [set.type, set.repetitions, set.repetitionQualifier])), [
      ["Разминочный", "12", "на каждую сторону"], ["Разминочный", "12", "на каждую сторону"],
      ["Подводящий", "12", "на каждую сторону"], ["Рабочий", "12–15", "на каждую сторону"],
      ["Рабочий", "12–15", "на каждую сторону"]
    ]);
  }
});

test("unilateral accessory and bodyweight modes qualify every set without changing their schemes", () => {
  const accessory = load.getPrescription({ ...data.exerciseById.ex014, unilateral: true });
  assert.equal(accessory.scheme, "2+2");
  assert.equal(accessory.setCount, 4);
  assert.ok(accessory.sets.every(set => set.repetitionQualifier === "на каждую сторону"));
  for (const id of load.BODYWEIGHT_IDS) {
    const result = load.getPrescription({ ...data.exerciseById[id], unilateral: true });
    assert.equal(result.scheme, "5×12");
    assert.equal(result.setCount, 5);
    assert.ok(result.sets.every(set => set.repetitions === "12" && set.repetitionQualifier === "на каждую сторону"));
  }
});

test("ex045 has exactly two warmup and two working sets with repetitions per arm", () => {
  const result = get("ex045");
  assert.equal(result.scheme, "2+2");
  assert.equal(result.setCount, 4);
  assert.equal(result.summaryRepetitions, "12–15 рабочих повт. на каждую руку");
  assert.deepEqual(plain(result.sets.map(set => [set.type, set.repetitions, set.repetitionQualifier])), [
    ["Разминочный", "12", "на каждую руку"], ["Разминочный", "12", "на каждую руку"],
    ["Рабочий", "12–15", "на каждую руку"], ["Рабочий", "12–15", "на каждую руку"]
  ]);
  const saved = core.defaultState();
  saved.blocks.block1["block1-position5"] = "ex045";
  const restored = core.restoreState(JSON.stringify(saved));
  assert.equal(restored.repaired, false);
  assert.deepEqual(plain(restored.state), plain(saved));
  assert.equal(get(restored.state.blocks.block1["block1-position5"]).scheme, "2+2");
});

test("unilateral presentation never changes the base prescription or adds labels to bilateral exercises", () => {
  for (const exercise of data.exercises) {
    const bilateral = load.getPrescription({ ...exercise, unilateral: false });
    assert.ok(bilateral.sets.every(set => set.repetitionQualifier === undefined));
    assert.doesNotMatch(bilateral.summaryRepetitions, /на каждую сторону/);
    const result = load.getPrescription(exercise);
    assert.equal(result.rest, bilateral.rest);
    assert.equal(result.scheme, bilateral.scheme);
    assert.equal(result.setCount, bilateral.setCount);
    assert.equal(result.instruction, bilateral.instruction);
    assert.deepEqual(plain(result.sets.map(({ repetitionQualifier, ...set }) => set)), plain(bilateral.sets));
  }
});

test("v1.0/v1.1 choices for unilateral rows and Face Pull survive restore without migration", () => {
  const saved = core.defaultState();
  saved.blocks.block2["block2-position1"] = "ex025";
  saved.blocks.block3["block3-position5"] = "ex030";
  const serialized = JSON.stringify(saved);
  const restored = core.restoreState(serialized);
  assert.equal(restored.repaired, false);
  assert.equal(JSON.stringify(restored.state), serialized);
  assert.ok(get(restored.state.blocks.block2["block2-position1"]).sets.every(set => set.repetitionQualifier === "на каждую сторону"));
  assert.equal(data.exerciseById[restored.state.blocks.block3["block3-position5"]].name, "Тяга каната к лицу (Face Pull)");
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
