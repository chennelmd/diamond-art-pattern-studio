// Requires Playwright and a running server. Run in a fresh browser context only.
// DIAMOND_TEST_URL=http://127.0.0.1:4173 node tests/project-history.browser.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.DIAMOND_TEST_URL || 'http://127.0.0.1:4173');
    const image = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 32;
      const context = canvas.getContext('2d');
      context.fillStyle = 'red';
      context.fillRect(0, 0, 24, 32);
      context.fillStyle = 'blue';
      context.fillRect(24, 0, 24, 32);
      return canvas.toDataURL().split(',')[1];
    });
    await page.click('#startProject');
    await page.setInputFiles('#artwork', {
      name: 'history-regression.png', mimeType: 'image/png', buffer: Buffer.from(image, 'base64'),
    });
    await page.click('#continueBtn');
    await page.waitForFunction(() => selectedImage?.complete && !document.querySelector('#setupView').hidden);
    await page.fill('#targetWidth', '5');
    await page.dispatchEvent('#targetWidth', 'input');
    await page.click('#generatePattern');
    await page.waitForFunction(() => generatedPattern && !document.querySelector('#patternResult').hidden);
    await page.click('#openEditor');
    await page.click('[data-tool="erase"]');
    await page.locator('#editorCanvas').click({ position: { x: 49, y: 49 } });
    assert.equal(await page.evaluate(() => generatedPattern.cells[0]), -1);
    assert.equal(await page.locator('#undoEdit').isEnabled(), true);
    await page.click('#saveProject');
    await page.waitForFunction(() => document.querySelector('#projectSaveStatus').textContent.startsWith('Saved locally'));

    // Seed another saved project with a different first cell. The two projects
    // must never share transactions, including an unfinished pointer stroke.
    await page.evaluate(async () => {
      const project = await PatternProjects.get(currentProjectId);
      project.id = 'other-project';
      project.name = 'Other project';
      project.pattern.cells[0] = 1;
      await PatternProjects.save(project);
    });
    await page.click('#backToProjects');
    await page.locator('[data-project-id="other-project"]').click();
    await page.waitForFunction(() => currentProjectId === 'other-project' && !document.querySelector('#editorPanel').hidden);
    assert.equal(await page.locator('#undoEdit').isDisabled(), true);
    assert.equal(await page.locator('#redoEdit').isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => [editorUndoStack.length, editorRedoStack.length, activeEditTransaction]), [0, 0, null]);
    assert.equal(await page.evaluate(() => generatedPattern.cells[0]), 1);

    // Editing in the new project still supports undo/redo.
    await page.click('[data-tool="erase"]');
    await page.locator('#editorCanvas').click({ position: { x: 49, y: 49 } });
    assert.equal(await page.evaluate(() => generatedPattern.cells[0]), -1);
    await page.click('#undoEdit');
    assert.equal(await page.evaluate(() => generatedPattern.cells[0]), 1);
    assert.equal(await page.locator('#redoEdit').isEnabled(), true);
    await page.click('#backToProjects');
    await page.evaluate(() => { activeEditTransaction = [{ index: 0, previousValue: 1, nextValue: -1 }]; });
    await page.locator('.saved-project:not([data-project-id="other-project"])').click();
    await page.waitForFunction(() => currentProjectId !== 'other-project' && !document.querySelector('#editorPanel').hidden);
    assert.equal(await page.locator('#undoEdit').isDisabled(), true);
    assert.equal(await page.locator('#redoEdit').isDisabled(), true);
    assert.deepEqual(await page.evaluate(() => [editorUndoStack.length, editorRedoStack.length, activeEditTransaction]), [0, 0, null]);
    assert.equal(await page.evaluate(() => generatedPattern.cells[0]), -1);
    assert.deepEqual(errors, []);
    console.log('Cross-project undo, redo, active stroke isolation, and new-project editing passed');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
