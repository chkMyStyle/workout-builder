"use strict";

// Optional development check. The application itself has no dependencies.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.WORKOUT_PLAYWRIGHT_PATH || "playwright");
const url = process.env.WORKOUT_TEST_URL || pathToFileURL(path.join(__dirname, "..", "index.html")).href;
const executablePath = process.env.WORKOUT_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const screenshots = process.env.WORKOUT_SCREENSHOT_DIR;
const defaults = [
  ["ex001", "ex041", "ex055", "ex014", "ex044", "ex009"],
  ["ex024", "ex031", "ex022", "ex034", "ex048", "ex052"],
  ["ex012", "ex039", "ex017", "ex015", "ex046", "ex007"],
  ["ex020", "ex032", "ex028", "ex037", "ex054", "ex049"]
];
const defaultSchemes = [
  ["2+1+2", "2+1+2", "3×макс.", "2+2", "2+2", "2+1+2"],
  ["2+1+2", "2+1+2", "5×12", "2+1+2", "2+2", "2+2"],
  ["2+1+2", "2+1+2", "2+2", "2+2", "2+2", "2+1+2"],
  ["5×12", "2+1+2", "2+1+2", "5×12", "2+2", "2+2"]
];

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    const thirdPartyRequests = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(url).origin) thirdPartyRequests.push(request.url());
    });
    await page.goto(url);
    const templates = await page.evaluate(() => window.WorkoutTemplates);
    const libraryInfo = await page.evaluate(() => ({
      count: window.WorkoutData.exercises.length,
      newExercise: window.WorkoutData.exerciseById.ex059,
      newScheme: window.WorkoutLoad.getPrescription(window.WorkoutData.exerciseById.ex059).scheme
    }));
    assert.equal(libraryInfo.count, 60);
    assert.equal(libraryInfo.newExercise.name, "Обратные отжимания от скамьи");
    assert.deepEqual(libraryInfo.newExercise.alternativeForExerciseIds, ["ex038"]);
    assert.equal(libraryInfo.newScheme, "5×12");
    const storageKey = "strength-workout-builder:v1";
    const row = id => page.locator(`.exercise-row[data-position-id="${id}"]`);
    const selectBlock = id => page.locator(`#tab-${id}`).click();
    const rowState = () => page.locator(".exercise-row").evaluateAll(rows => rows.map(item => ({
      id: item.dataset.exerciseId, position: item.dataset.positionId,
      scheme: item.querySelector(".load-summary")?.dataset.loadScheme
    })));
    const assertUnique = async () => {
      const ids = (await rowState()).map(item => item.id);
      assert.equal(ids.length, 6);
      assert.equal(new Set(ids).size, 6);
    };
    const change = async (positionId, id) => {
      await row(positionId).locator("button.replace-button").click();
      await page.locator(`.option-button[data-exercise-id="${id}"]`).click();
      await page.waitForFunction(() => !document.querySelector("#replacement-dialog").open);
    };

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      await selectBlock(template.id);
      const actual = await rowState();
      assert.deepEqual(actual.map(item => item.id), defaults[i]);
      assert.deepEqual(actual.map(item => item.scheme), defaultSchemes[i]);
      await assertUnique();
      for (const position of template.positions) {
        if (position.allowedExerciseIds.length === 1) {
          assert.equal(await row(position.positionId).locator("button,select").count(), 0);
        } else if (position.positionId === "block3-position4") {
          assert.deepEqual(await row(position.positionId).locator("option").evaluateAll(options => options.map(option => option.value)), ["ex015", "ex016"]);
        } else {
          await row(position.positionId).locator("button.replace-button").click();
          assert.deepEqual(await page.locator(".option-button").evaluateAll(options => options.map(option => option.dataset.exerciseId)), position.allowedExerciseIds);
          await page.keyboard.press("Escape");
          await page.waitForFunction(() => !document.querySelector("#replacement-dialog").open);
        }
      }
    }
    console.log("PASS: all four original blocks, order, exact allowed menus, no duplicates and correct default load schemes");

    await selectBlock("block1");
    const beforeArmRaise = await rowState();
    await change("block1-position5", "ex045");
    await row("block1-position5").locator("summary").click();
    assert.equal(await row("block1-position5").locator(".exercise-title").textContent(), "Отведение руки в сторону с нижнего блока");
    assert.equal(await row("block1-position5").locator(".load-badge").textContent(), "2+2");
    assert.deepEqual(await row("block1-position5").locator(".set-type").allTextContents(), ["Разминочный", "Разминочный", "Рабочий", "Рабочий"]);
    assert.deepEqual(await row("block1-position5").locator(".set-repetitions").evaluateAll(elements => elements.map(element => element.firstChild.textContent)), ["12", "12", "12–15", "12–15"]);
    assert.deepEqual(await row("block1-position5").locator(".set-side").allTextContents(), Array(4).fill("на каждую руку"));
    assert.ok(await row("block1-position5").locator(".set-side").first().isVisible());
    const afterArmRaise = await rowState();
    for (let i = 0; i < 6; i++) if (i !== 4) assert.deepEqual(afterArmRaise[i], beforeArmRaise[i]);
    await page.reload();
    assert.equal(await row("block1-position5").getAttribute("data-exercise-id"), "ex045");
    assert.equal(await row("block1-position5").locator(".exercise-title").textContent(), "Отведение руки в сторону с нижнего блока");
    assert.deepEqual(await row("block1-position5").locator(".set-side").allTextContents(), Array(4).fill("на каждую руку"));
    await row("block1-position5").locator("summary").click();
    await page.setViewportSize({ width: 320, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (screenshots) {
      fs.mkdirSync(screenshots, { recursive: true });
      await row("block1-position5").screenshot({ path: path.join(screenshots, "single-arm-cable-raise.png") });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await change("block1-position5", "ex044");
    assert.equal(await row("block1-position5").locator(".set-side").count(), 0);
    console.log("PASS: ex045 replacement shows the new name, four correct per-arm sets, preserves other rows and saved choices, fits 320 px and removes the label on return");

    await selectBlock("block2");
    const beforeUnilateral = await rowState();
    await change("block2-position1", "ex025");
    await row("block2-position1").locator("summary").click();
    assert.match(await row("block2-position1").locator(".load-summary").textContent(), /на каждую сторону/);
    assert.deepEqual(await row("block2-position1").locator(".set-side").allTextContents(), Array(5).fill("на каждую сторону"));
    assert.ok(await row("block2-position1").locator(".set-side").first().isVisible());
    const afterUnilateral = await rowState();
    for (let i = 1; i < 6; i++) assert.deepEqual(afterUnilateral[i], beforeUnilateral[i]);
    await page.reload();
    assert.equal(await row("block2-position1").getAttribute("data-exercise-id"), "ex025");
    await row("block2-position1").locator("summary").click();
    assert.equal(await row("block2-position1").locator(".set-side").count(), 5);
    await change("block2-position1", "ex024");
    assert.equal(await row("block2-position1").locator(".set-side").count(), 0);
    assert.doesNotMatch(await row("block2-position1").locator(".load-summary").textContent(), /на каждую сторону/);
    console.log("PASS: per-side label appears in every set after replacement, survives reload, disappears on bilateral replacement and leaves other positions intact");

    await selectBlock("block1");
    await change("block1-position3", "ex060");
    assert.equal(await row("block1-position3").locator(".exercise-title").textContent(), "Подъём прямых ног к перекладине");
    assert.equal(await row("block1-position3").locator(".load-badge").textContent(), "3×макс.");
    assert.equal(await row("block1-position3").locator(".set-row").count(), 3);
    await page.reload();
    assert.equal(await row("block1-position3").getAttribute("data-exercise-id"), "ex060");
    await page.locator("#reset-workout").click();
    await selectBlock("block3");
    await change("block3-position5", "ex030");
    assert.equal(await row("block3-position5").locator(".exercise-title").textContent(), "Тяга каната к лицу (Face Pull)");
    assert.equal(await row("block3-position5").locator("button.replace-button").getAttribute("aria-label"), "Заменить: Тяга каната к лицу (Face Pull)");
    await row("block3-position5").locator("button.replace-button").click();
    assert.equal(await page.locator('.option-button[data-exercise-id="ex030"] .option-title').textContent(), "Тяга каната к лицу (Face Pull)");
    await page.locator("#close-dialog").click();
    await page.reload();
    assert.equal(await row("block3-position5").locator(".exercise-title").textContent(), "Тяга каната к лицу (Face Pull)");
    await page.locator("#reset-workout").click();
    console.log("PASS: toes-to-bar is an allowed core replacement with 3×max, and Face Pull updates card, menu, accessible name and saved display");

    await selectBlock("block1");
    await row("block1-position1").locator("summary").click();
    assert.equal(await row("block1-position1").locator(".set-row").count(), 5);
    assert.deepEqual(await row("block1-position1").locator(".set-type").allTextContents(), ["Разминочный", "Разминочный", "Подводящий", "Рабочий", "Рабочий"]);
    await row("block1-position3").locator("summary").click();
    assert.equal(await row("block1-position3").locator(".set-row").count(), 3);
    assert.equal(await row("block1-position3").locator(".set-weight").count(), 0);
    await page.locator("#training-guide > summary").click();
    assert.equal(await page.locator("#progression-steps li").count(), 5);
    assert.match(await page.locator("#progression-steps").textContent(), /обоих рабочих подходах достигнуты 15/);
    const rest = await page.locator("#rest-recommendation").textContent();
    assert.equal(rest, await page.evaluate(() => window.WorkoutLoad.REST_RECOMMENDATION));
    assert.ok(await page.locator("#rest-recommendation").isVisible());
    const dipsGuide = page.locator(".guide-content p").filter({ hasText: /^Для брусьев:/ });
    assert.match(await dipsGuide.textContent(), /гравитрон с поддержкой для отжиманий на брусьях/);
    assert.doesNotMatch(await dipsGuide.textContent(), /колен|высок.*опор/);
    console.log("PASS: expanded set purposes, core technical maximum, visible rest recommendation and double progression instructions");

    await selectBlock("block2");
    await row("block2-position1").locator("summary").click();
    const before = await rowState();
    await change("block2-position2", "ex035");
    assert.equal(await row("block2-position2").locator(".load-summary").getAttribute("data-load-scheme"), "5×12");
    assert.equal(await row("block2-position1").locator("details").getAttribute("open"), "");
    const after = await rowState();
    for (let i = 0; i < after.length; i++) if (i !== 1) assert.deepEqual(after[i], before[i]);
    await row("block2-position2").locator("summary").click();
    assert.match(await row("block2-position2").locator(".load-instruction").textContent(), /с высокой опоры или с колен/);
    await assertUnique();
    await page.reload();
    assert.equal(await row("block2-position2").getAttribute("data-exercise-id"), "ex035");
    assert.equal(await row("block2-position2").locator(".load-badge").textContent(), "5×12");
    await change("block2-position2", "ex031");
    assert.equal(await row("block2-position2").locator(".load-badge").textContent(), "2+1+2");
    console.log("PASS: replacement recomputes load, preserves other rows and expanded details, reload restores both choice and derived scheme");

    // Seed the exact pre-v1.1 storage format, without load fields.
    const oldSave = {
      version: 1, activeBlockId: "block2",
      blocks: Object.fromEntries(defaults.map((ids, i) => [`block${i + 1}`, Object.fromEntries(ids.map((id, j) => [`block${i + 1}-position${j + 1}`, id]))]))
    };
    oldSave.blocks.block2["block2-position2"] = "ex035";
    oldSave.blocks.block1["block1-position1"] = "ex003";
    await page.evaluate(([key, saved]) => localStorage.setItem(key, JSON.stringify(saved)), [storageKey, oldSave]);
    await page.reload();
    assert.deepEqual(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey), oldSave);
    assert.equal(await row("block2-position2").locator(".load-badge").textContent(), "5×12");
    await selectBlock("block1");
    assert.equal(await row("block1-position1").getAttribute("data-exercise-id"), "ex003");
    await page.locator("#reset-workout").click();
    assert.deepEqual((await rowState()).map(item => item.id), defaults[0]);
    await selectBlock("block2");
    assert.equal(await row("block2-position2").getAttribute("data-exercise-id"), "ex035");
    await page.locator("#reset-workout").click();
    assert.deepEqual((await rowState()).map(item => item.scheme), defaultSchemes[1]);
    console.log("PASS: existing v1 localStorage is unchanged in format, old choices remain compatible, reset affects only its block");

    for (const width of [320, 375, 390, 430, 580, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const template of templates) {
        await selectBlock(template.id);
        const tabMetrics = await page.locator('[role="tab"]').evaluateAll(tabs => tabs.map(tab => ({
          left: tab.getBoundingClientRect().left, right: tab.getBoundingClientRect().right,
          height: tab.getBoundingClientRect().height, overflow: tab.scrollWidth > tab.clientWidth
        })));
        assert.ok(tabMetrics.every(tab => tab.left >= 0 && tab.right <= width && tab.height >= 44 && !tab.overflow), `tabs must remain readable and accessible at ${width}px`);
        if (template.id === "block1" && await row("block1-position3").getAttribute("data-exercise-id") !== "ex060") await change("block1-position3", "ex060");
        if (template.id === "block3" && await row("block3-position5").getAttribute("data-exercise-id") !== "ex030") await change("block3-position5", "ex030");
        await page.locator(".load-details, #training-guide").evaluateAll(details => details.forEach(item => { item.open = true; }));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `page overflow: ${width}, ${template.id}`);
        assert.equal(await page.locator(".set-list").evaluateAll(lists => lists.some(list => list.scrollWidth > list.clientWidth)), false, `set list overflow: ${width}`);
        await assertUnique();
        await row(template.positions[0].positionId).locator("button.replace-button").click();
        assert.equal(await page.locator("#replacement-dialog").evaluate(dialog => dialog.scrollWidth > dialog.clientWidth), false);
        await page.locator("#close-dialog").click();
      }
    }
    await selectBlock("block3");
    await row("block3-position4").locator("select").selectOption("ex016");
    assert.equal(await row("block3-position4").getAttribute("data-exercise-id"), "ex016");
    assert.equal(await row("block3-position4").locator(".load-badge").textContent(), "2+2");
    await page.reload();
    assert.equal(await row("block3-position4").getAttribute("data-exercise-id"), "ex016");
    assert.equal(await row("block3-position4").locator(".load-badge").textContent(), "2+2");
    console.log("PASS: no horizontal overflow with every disclosure expanded in all four blocks at 8 widths, 320–1440; leg curl save and scheme");

    await selectBlock("block1");
    await page.locator("#tab-block1").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator('[role="tab"][aria-selected="true"]').getAttribute("id"), "tab-block2");
    await page.keyboard.press("Home");
    const summary = row("block1-position1").locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    assert.ok(await row("block1-position1").locator("details").evaluate(details => details.open));
    console.log("PASS: keyboard navigation and native accessible disclosures");

    if (screenshots) {
      fs.mkdirSync(screenshots, { recursive: true });
      await page.setViewportSize({ width: 1440, height: 1100 });
      await row("block1-position1").locator("details").evaluate(details => { details.open = false; });
      await page.locator("#training-guide").evaluate(details => { details.open = false; });
      await page.screenshot({ path: path.join(screenshots, "desktop.png"), fullPage: true });
    }

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const mobile = await mobileContext.newPage();
    mobile.on("pageerror", error => errors.push(error.message));
    await mobile.goto(url);
    await mobile.locator('.exercise-row[data-position-id="block1-position1"] summary').tap();
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (screenshots) await mobile.screenshot({ path: path.join(screenshots, "mobile-expanded.png"), fullPage: true });
    await mobile.setViewportSize({ width: 320, height: 844 });
    const unilateralMobileRow = mobile.locator('.exercise-row[data-position-id="block1-position6"]');
    await unilateralMobileRow.locator("summary").tap();
    assert.equal(await unilateralMobileRow.locator(".set-side").count(), 5);
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (screenshots) await unilateralMobileRow.screenshot({ path: path.join(screenshots, "unilateral-mobile.png") });
    await mobile.locator("#tab-block4").tap();
    assert.equal(await mobile.locator('.exercise-row[data-position-id="block4-position1"] .load-badge').textContent(), "5×12");
    await mobileContext.close();
    console.log("PASS: touch-enabled mobile context can expand set instructions and switch workouts");

    // Dips are absent from the approved blocks. Use an isolated in-memory fixture
    // to check their future card rendering, without editing production templates.
    const fixtureContext = await browser.newContext({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });
    await fixtureContext.addInitScript(() => {
      // A synthetic unilateral bodyweight variant tests the generic mode only.
      let fixtureData;
      Object.defineProperty(window, "WorkoutData", {
        configurable: true,
        get() { return fixtureData; },
        set(data) {
          const exercises = data.exercises.map(exercise => exercise.id === "ex038" ? { ...exercise, unilateral: true } : exercise);
          fixtureData = { ...data, exercises, exerciseById: Object.fromEntries(exercises.map(exercise => [exercise.id, exercise])) };
        }
      });
      let fixtures;
      Object.defineProperty(window, "WorkoutTemplates", {
        configurable: true,
        get() { return fixtures; },
        set(templates) {
          fixtures = templates.map(template => ({
            ...template, positions: template.positions.map(position => ({ ...position, allowedExerciseIds: [...position.allowedExerciseIds] }))
          }));
          fixtures[0].positions[0] = {
            ...fixtures[0].positions[0], defaultExerciseId: "ex038", allowedExerciseIds: ["ex038", "ex059"]
          };
        }
      });
    });
    const fixture = await fixtureContext.newPage();
    fixture.on("pageerror", error => errors.push(error.message));
    await fixture.goto(url);
    const fixtureRow = fixture.locator('.exercise-row[data-position-id="block1-position1"]');
    await fixtureRow.locator("summary").tap();
    assert.equal(await fixtureRow.locator(".load-badge").textContent(), "5×12");
    assert.deepEqual(await fixtureRow.locator(".set-side").allTextContents(), Array(5).fill("на каждую сторону"));
    assert.match(await fixtureRow.locator(".load-instruction").textContent(), /гравитрон с поддержкой для отжиманий на брусьях/);
    assert.match(await fixtureRow.locator(".load-instruction").textContent(), /без боли и с контролируемой амплитудой/);
    assert.doesNotMatch(await fixtureRow.locator(".load-instruction").textContent(), /колен|высок.*опор/);
    await fixtureRow.locator("button.replace-button").tap();
    await fixture.locator('.option-button[data-exercise-id="ex059"]').tap();
    assert.equal(await fixtureRow.getAttribute("data-exercise-id"), "ex059");
    assert.equal(await fixtureRow.locator(".load-badge").textContent(), "5×12");
    assert.equal(await fixtureRow.locator(".set-side").count(), 0);
    assert.match(await fixtureRow.locator(".load-instruction").textContent(), /более лёгкое положение ног/);
    assert.match(await fixtureRow.locator(".load-instruction").textContent(), /Не выполняйте упражнение через боль/);
    assert.equal(await fixture.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (screenshots) await fixtureRow.screenshot({ path: path.join(screenshots, "reverse-bench-pushup-fixture.png") });
    await fixtureContext.close();
    console.log("PASS: isolated fixture renders distinct dip guidance and reverse bench pushup 5×12 at 320 px without changing any approved position");

    // Simulate unclassifiable exercise data through the prescription boundary.
    await page.evaluate(() => {
      const original = window.WorkoutLoad;
      window.WorkoutLoad = {
        ...original,
        getPrescription(exercise) { return original.getPrescription(exercise.id === "ex001" ? { ...exercise, role: "Неизвестно" } : exercise); }
      };
    });
    await selectBlock("block1");
    assert.match(await row("block1-position1").locator(".load-error").textContent(), /ex001.*неизвестная роль/);
    assert.equal(await row("block1-position1").locator(".load-summary").count(), 0);
    assert.equal(await page.locator(".load-summary").count(), 5);
    assert.deepEqual(errors, []);
    assert.deepEqual(thirdPartyRequests, []);
    console.log("PASS: readable per-exercise diagnostic without a random scheme; no JS errors or third-party requests");
    await context.close();
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
