"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = vm.createContext({ window: {} });
for (const file of ["exercises.js", "templates.js", "app.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
}
const { WorkoutCore: core, WorkoutTemplates: templates, WorkoutData: data } = context.window;
const plain = value => JSON.parse(JSON.stringify(value));

// Independent transcription of the approved matrix: first ID = default.
const approved = [
  [
    ["ex001", "ex003", "ex004", "ex005", "ex006", "ex002"],
    ["ex041", "ex040", "ex039"], ["ex055", "ex056", "ex057"],
    ["ex014"], ["ex044", "ex045"], ["ex009", "ex008", "ex010", "ex011"]
  ],
  [
    ["ex024", "ex028", "ex026", "ex027", "ex025"], ["ex031", "ex032", "ex033", "ex035"],
    ["ex022", "ex019", "ex020", "ex021", "ex023"], ["ex034", "ex037"],
    ["ex048", "ex047", "ex050", "ex049"], ["ex052", "ex053", "ex054"]
  ],
  [
    ["ex012", "ex013"], ["ex039", "ex040", "ex041"], ["ex017", "ex018"],
    ["ex015", "ex016"], ["ex046", "ex030"], ["ex007", "ex009", "ex010", "ex011"]
  ],
  [
    ["ex020", "ex019", "ex022", "ex021", "ex023"], ["ex032", "ex031", "ex033", "ex035"],
    ["ex028", "ex026", "ex027", "ex025", "ex024"], ["ex037", "ex034"],
    ["ex054", "ex053", "ex052"], ["ex049", "ex048", "ex047", "ex050"]
  ]
];

test("58 unique canonical exercises and complete classifications", () => {
  assert.equal(data.exercises.length, 58);
  assert.equal(new Set(data.exercises.map(exercise => exercise.id)).size, 58);
  assert.equal(data.exercises.some(exercise => /ягодичный мост|гравитрон|классическая становая/i.test(exercise.name)), false);
  const counts = {};
  for (const exercise of data.exercises) {
    for (const key of ["id", "name", "category", "primaryMuscles", "secondaryMuscles", "movement", "role"]) assert.ok(exercise[key]);
    counts[exercise.category] = (counts[exercise.category] || 0) + 1;
  }
  assert.deepEqual(Object.values(counts), [18, 12, 8, 8, 4, 4, 4]);
});

test("all 24 positions match the complete approved default and substitution matrix", () => {
  assert.equal(templates.length, 4);
  const ids = new Set();
  templates.forEach((template, blockIndex) => {
    assert.equal(template.positions.length, 6);
    template.positions.forEach((position, index) => {
      assert.ok(!ids.has(position.positionId));
      ids.add(position.positionId);
      assert.equal(position.defaultExerciseId, approved[blockIndex][index][0]);
      assert.deepEqual(plain(position.allowedExerciseIds), approved[blockIndex][index]);
      for (const id of position.allowedExerciseIds) assert.ok(data.exerciseById[id]);
    });
    assert.ok(core.isValidSelection(template, core.createDefaults(template)));
  });
  assert.equal(ids.size, 24);
});

test("leg extension is fixed; leg curls have exactly seated and lying variants", () => {
  const fixed = templates[0].positions[3];
  assert.deepEqual(plain(fixed.allowedExerciseIds), ["ex014"]);
  assert.equal(core.replaceExercise(templates[0], core.createDefaults(templates[0]), fixed.positionId, "ex015"), null);
  assert.deepEqual(plain(templates[2].positions[3].allowedExerciseIds), ["ex015", "ex016"]);
});

test("behind-the-neck presses remain in the library but cannot be substituted", () => {
  assert.ok(data.exerciseById.ex042 && data.exerciseById.ex043);
  for (const template of templates) for (const position of template.positions) {
    assert.ok(!position.allowedExerciseIds.includes("ex042"));
    assert.ok(!position.allowedExerciseIds.includes("ex043"));
  }
});

test("every authorized alternative changes only its own position and can return to default", () => {
  for (const template of templates) {
    const initial = core.createDefaults(template);
    for (const position of template.positions) for (const id of position.allowedExerciseIds) {
      const changed = core.replaceExercise(template, initial, position.positionId, id);
      assert.ok(changed);
      for (const other of template.positions) if (other !== position) assert.equal(changed[other.positionId], initial[other.positionId]);
      assert.deepEqual(plain(core.replaceExercise(template, changed, position.positionId, position.defaultExerciseId)), plain(initial));
      assert.deepEqual(plain(initial), plain(core.createDefaults(template)), "must not mutate the original selection");
    }
  }
});

test("unknown position, unknown ID, disallowed ID and malformed selection are rejected", () => {
  const template = templates[0];
  const selection = core.createDefaults(template);
  assert.equal(core.replaceExercise(template, selection, "missing", "ex003"), null);
  for (const id of ["ex999", "ex058", "__proto__", null, {}]) assert.equal(core.replaceExercise(template, selection, template.positions[0].positionId, id), null);
  assert.equal(core.isValidSelection(template, []), false);
  assert.equal(core.isValidSelection(template, null), false);
});

// The approved lists don't overlap within a block. A synthetic fixture tests the
// duplicate guard and release behavior without changing any production template.
const overlapFixture = {
  positions: [
    { positionId: "a", defaultExerciseId: "ex001", allowedExerciseIds: ["ex001", "ex003", "ex005"] },
    { positionId: "b", defaultExerciseId: "ex003", allowedExerciseIds: ["ex003", "ex001", "ex005"] }
  ]
};

test("IDs used in another position are hidden and rejected", () => {
  const selection = core.createDefaults(overlapFixture);
  assert.deepEqual(plain(core.availableExercises(overlapFixture, selection, "a")), ["ex001", "ex005"]);
  assert.equal(core.replaceExercise(overlapFixture, selection, "a", "ex003"), null);
  assert.equal(core.isValidSelection(overlapFixture, { a: "ex001", b: "ex001" }), false);
});

test("returning to the default releases the previous alternative for another position", () => {
  const initial = core.createDefaults(overlapFixture);
  const changed = core.replaceExercise(overlapFixture, initial, "a", "ex005");
  assert.ok(!core.availableExercises(overlapFixture, changed, "b").includes("ex005"));
  const returned = core.replaceExercise(overlapFixture, changed, "a", "ex001");
  assert.ok(core.availableExercises(overlapFixture, returned, "b").includes("ex005"));
  assert.ok(core.replaceExercise(overlapFixture, returned, "b", "ex005"));
});

test("the same ID is allowed in different blocks and valid state survives serialization", () => {
  const state = core.defaultState();
  state.blocks.block1 = core.replaceExercise(templates[0], state.blocks.block1, "block1-position2", "ex039");
  assert.equal(state.blocks.block1["block1-position2"], state.blocks.block3["block3-position2"]);
  state.activeBlockId = "block3";
  const restored = core.restoreState(JSON.stringify(state));
  assert.equal(restored.repaired, false);
  assert.deepEqual(plain(restored.state), plain(state));
});

test("reset of the current block preserves other modified blocks", () => {
  const state = core.defaultState();
  state.blocks.block1["block1-position1"] = "ex003";
  state.blocks.block2["block2-position1"] = "ex025";
  state.blocks.block1 = core.createDefaults(templates[0]);
  const restored = core.restoreState(JSON.stringify(state));
  assert.deepEqual(plain(restored.state.blocks.block1), plain(core.createDefaults(templates[0])));
  assert.equal(restored.state.blocks.block2["block2-position1"], "ex025");
});

test("malformed JSON, wrong schema and non-object data safely restore defaults", () => {
  for (const raw of ["{bad json", "null", "[]", "42", '{"version":999,"blocks":{}}', '{"version":1,"blocks":null}']) {
    const restored = core.restoreState(raw);
    assert.equal(restored.repaired, true);
    assert.deepEqual(plain(restored.state), plain(core.defaultState()));
  }
  assert.equal(core.restoreState(null).repaired, false);
});

test("invalid IDs, missing positions, extra positions and duplicates repair only the affected block", () => {
  const corruptions = [
    block => { block["block1-position1"] = "ex999"; },
    block => { block["block1-position1"] = "ex014"; },
    block => { block["block1-position1"] = { toString: null }; },
    block => { delete block["block1-position1"]; },
    block => { block.extra = "ex003"; }
  ];
  for (const corrupt of corruptions) {
    const state = core.defaultState();
    state.blocks.block2["block2-position1"] = "ex025";
    corrupt(state.blocks.block1);
    const restored = core.restoreState(JSON.stringify(state));
    assert.equal(restored.repaired, true);
    assert.deepEqual(plain(restored.state.blocks.block1), plain(core.createDefaults(templates[0])));
    assert.equal(restored.state.blocks.block2["block2-position1"], "ex025");
  }
});
