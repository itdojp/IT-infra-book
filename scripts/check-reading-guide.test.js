'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { after, test } = require('node:test');

const { validateReadingGuide } = require('./check-reading-guide');

const repoRoot = path.resolve(__dirname, '..');
const scratchRoot = path.join(repoRoot, '.codex-local', 'tmp', 'reading-guide-tests');
const indexPath = 'docs/index.md';

after(() => {
  fs.rmSync(scratchRoot, { recursive: true, force: true });
  for (const candidate of [path.dirname(scratchRoot), path.dirname(path.dirname(scratchRoot))]) {
    if (fs.existsSync(candidate) && fs.readdirSync(candidate).length === 0) fs.rmdirSync(candidate);
  }
});

function copy(relativePath, fixture) {
  const destination = path.join(fixture, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, relativePath), destination);
}

function makeFixture(t) {
  fs.mkdirSync(scratchRoot, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(scratchRoot, 'reading-guide-test-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  copy(indexPath, fixture);
  for (let chapter = 1; chapter <= 13; chapter += 1) {
    copy(`docs/chapters/chapter${String(chapter).padStart(2, '0')}/index.md`, fixture);
  }
  copy('docs/introduction/index.md', fixture);
  return fixture;
}

function replaceRequired(root, search, replacement, all = false) {
  const filePath = path.join(root, indexPath);
  const original = fs.readFileSync(filePath, 'utf8');
  assert.ok(original.includes(search), `mutation source not found: ${search}`);
  const updated = all ? original.split(search).join(replacement) : original.replace(search, replacement);
  fs.writeFileSync(filePath, updated);
}

test('canonical reading guide matches the published chapter order and topics', () => {
  const result = validateReadingGuide(repoRoot);
  assert.equal(result.bulletCount, 5);
  assert.ok(result.linkCount >= 13);
});

test('the obsolete chapter 1-3 OS/virtualization claim is rejected', (t) => {
  const fixture = makeFixture(t);
  replaceRequired(
    fixture,
    'プロトコルスタック、L2、L3のネットワーク基礎を整理する。',
    'プロトコルスタックとOS/仮想化の関係を俯瞰する。',
  );
  assert.throws(() => validateReadingGuide(fixture), /obsolete reading-guide claim remains/);
});

test('a missing chapter 6 route is rejected', (t) => {
  const fixture = makeFixture(t);
  replaceRequired(fixture, 'chapters/chapter06/', 'chapters/chapter60/', true);
  assert.throws(() => validateReadingGuide(fixture), /overview route is missing or out of order: chapters\/chapter06\//);
});

test('placing chapter 8 before chapter 6 in the overview is rejected', (t) => {
  const fixture = makeFixture(t);
  replaceRequired(
    fixture,
    '[第6章](chapters/chapter06/)（OS内部構造）→[第7章](chapters/chapter07/)（ストレージ）→[第8章](chapters/chapter08/)（仮想化/コンテナ）',
    '[第8章](chapters/chapter08/)（仮想化/コンテナ）→[第7章](chapters/chapter07/)（ストレージ）→[第6章](chapters/chapter06/)（OS内部構造）',
  );
  assert.throws(() => validateReadingGuide(fixture), /overview route is missing or out of order/);
});

test('a missing OS-before-virtualization dependency is rejected', (t) => {
  const fixture = makeFixture(t);
  replaceRequired(fixture, '仮想化/コンテナは、第6章を読んでから第8章へ進む', '仮想化/コンテナは、第8章から読む');
  assert.throws(() => validateReadingGuide(fixture), /missing required marker: 仮想化\/コンテナは、第6章を読んでから第8章へ進む/);
});

test('a local chapter link without a published target is rejected', (t) => {
  const fixture = makeFixture(t);
  fs.rmSync(path.join(fixture, 'docs/chapters/chapter08/index.md'));
  assert.throws(() => validateReadingGuide(fixture), /link has no published target: chapters\/chapter08\//);
});

test('an absolute local link is rejected before filesystem lookup', (t) => {
  const fixture = makeFixture(t);
  replaceRequired(fixture, '\n## 実務適用前', '\n- [unsafe absolute path](/etc/passwd)\n\n## 実務適用前');
  assert.throws(() => validateReadingGuide(fixture), /link is not a safe docs-relative path: \/etc\/passwd/);
});

test('a traversal link is rejected before it can escape docs', (t) => {
  const fixture = makeFixture(t);
  replaceRequired(fixture, '\n## 実務適用前', '\n- [unsafe traversal](../package.json)\n\n## 実務適用前');
  assert.throws(() => validateReadingGuide(fixture), /link is not a safe docs-relative path: \.\.\/package\.json/);
});
