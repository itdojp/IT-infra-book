'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { validateFigureIndex } = require('./check-figure-index');

const repoRoot = path.resolve(__dirname, '..');
const scratchRoot = path.join(repoRoot, '.codex-local/tmp');

function copy(relativePath, fixtureRoot) {
  const source = path.join(repoRoot, relativePath);
  const destination = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
}

function makeFixture(t) {
  fs.mkdirSync(scratchRoot, { recursive: true });
  const fixtureRoot = fs.mkdtempSync(path.join(scratchRoot, 'figure-index-test-'));
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));

  for (const relativePath of [
    'book-config.json',
    'figure-index.json',
    'src/appendices/appendix02/index.md',
    'src/appendices/figure-index/index.md',
    'docs/appendices/appendix02/index.md',
    'docs/appendices/figure-index/index.md',
    'docs/afterword/index.md',
    'docs/index.md',
    'docs/_data/navigation.yml',
    'docs/_layouts/book.html',
    'docs/assets/css/main.css',
  ]) copy(relativePath, fixtureRoot);

  const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'figure-index.json'), 'utf8'));
  for (const relativePath of new Set(manifest.flatMap((figure) => [
    figure.source,
    figure.public,
    path.posix.join('docs', figure.asset.replace(/^\/+/, '')),
  ]))) copy(relativePath, fixtureRoot);

  return fixtureRoot;
}

function replaceInFile(root, relativePath, search, replacement) {
  const filePath = path.join(root, relativePath);
  const original = fs.readFileSync(filePath, 'utf8');
  assert.notEqual(original.indexOf(search), -1, `fixture mutation target not found in ${relativePath}`);
  fs.writeFileSync(filePath, original.replace(search, replacement));
}

function mutateBothIndexes(root, mutation) {
  for (const relativePath of [
    'src/appendices/figure-index/index.md',
    'docs/appendices/figure-index/index.md',
  ]) {
    const filePath = path.join(root, relativePath);
    fs.writeFileSync(filePath, mutation(fs.readFileSync(filePath, 'utf8')));
  }
}

test('canonical repository has exact bidirectional 15-figure coverage', () => {
  assert.deepEqual(validateFigureIndex(repoRoot), { figureCount: 15, assetCount: 15 });
});

test('README images and unreferenced or duplicate candidate SVG files stay excluded', (t) => {
  const fixture = makeFixture(t);
  for (const relativePath of [
    'docs/assets/images/diagrams/chapter01/osi-tcp-ip-comparison.svg',
    'docs/assets/images/diagrams/chapter01/layer-interaction-performance.svg',
  ]) copy(relativePath, fixture);
  fs.writeFileSync(path.join(fixture, 'README.md'), '![図99-1: README画像](readme.svg)\n```mermaid\ngraph LR\nA-->B\n```\n');
  assert.deepEqual(validateFigureIndex(fixture), { figureCount: 15, assetCount: 15 });
});

test('missing source Mermaid is rejected', (t) => {
  const fixture = makeFixture(t);
  replaceInFile(fixture, 'src/chapters/chapter01/index.md', '```mermaid', '```text');
  assert.throws(() => validateFigureIndex(fixture), /source Mermaid count: expected 15, got 14/);
});

test('duplicate source anchor is rejected', (t) => {
  const fixture = makeFixture(t);
  replaceInFile(fixture, 'src/chapters/chapter01/index.md', 'id="figure-1-2"', 'id="figure-1-1"');
  assert.throws(() => validateFigureIndex(fixture), /duplicate id: figure-1-1/);
});

test('extra source Mermaid is rejected', (t) => {
  const fixture = makeFixture(t);
  const filePath = path.join(fixture, 'src/chapters/chapter01/index.md');
  fs.appendFileSync(filePath, '\n```mermaid\ngraph LR\nEXTRA-->FIGURE\n```\n');
  assert.throws(() => validateFigureIndex(fixture), /source Mermaid count: expected 15, got 16/);
});

test('residual public Mermaid is rejected', (t) => {
  const fixture = makeFixture(t);
  const filePath = path.join(fixture, 'docs/chapters/chapter11/index.md');
  fs.appendFileSync(filePath, '\n```mermaid\ngraph LR\nPUBLIC-->MERMAID\n```\n');
  assert.throws(() => validateFigureIndex(fixture), /public chapter Mermaid count: expected 0, got 1/);
});

test('missing public stable anchor is rejected', (t) => {
  const fixture = makeFixture(t);
  replaceInFile(
    fixture,
    'docs/chapters/chapter01/index.md',
    '{: #figure-1-1}\n',
    '',
  );
  assert.throws(() => validateFigureIndex(fixture), /public SVG figures count: expected 15, got 14/);
});

test('missing public asset is rejected', (t) => {
  const fixture = makeFixture(t);
  fs.rmSync(path.join(fixture, 'docs/assets/images/diagrams/chapter11/split-brain-prevention.svg'));
  assert.throws(() => validateFigureIndex(fixture), /public asset is missing or empty: \/assets\/images\/diagrams\/chapter11\/split-brain-prevention\.svg/);
});

test('duplicate public asset mapping is rejected', (t) => {
  const fixture = makeFixture(t);
  replaceInFile(
    fixture,
    'docs/chapters/chapter01/index.md',
    '/assets/images/diagrams/chapter01/encapsulation-decapsulation.svg',
    '/assets/images/diagrams/chapter01/osi-tcpip-comparison.svg',
  );
  assert.throws(() => validateFigureIndex(fixture), /public numbered figures have duplicate assets/);
});

test('extra numbered public SVG is rejected', (t) => {
  const fixture = makeFixture(t);
  copy('docs/assets/images/diagrams/chapter01/osi-tcp-ip-comparison.svg', fixture);
  // Put the extra figure outside docs/chapters to ensure the public inventory
  // is fail-closed across the complete published tree.
  const filePath = path.join(fixture, 'docs/index.md');
  fs.appendFileSync(filePath, [
    '',
    '<figure id="figure-99-1" class="book-figure">',
    '  <img',
    '    src="{{ \'/assets/images/diagrams/chapter01/osi-tcp-ip-comparison.svg\' | relative_url }}"',
    '    alt="図99-1: 本文の正規図版ではない旧候補SVG"',
    '    loading="lazy"',
    '    decoding="async">',
    '  <figcaption>図99-1: 余分な図版</figcaption>',
    '</figure>',
    '',
  ].join('\n'));
  assert.throws(() => validateFigureIndex(fixture), /public numbered SVG count: expected 15, got 16/);
});

test('single-quoted extra numbered public SVG is rejected', (t) => {
  const fixture = makeFixture(t);
  copy('docs/assets/images/diagrams/chapter01/osi-tcp-ip-comparison.svg', fixture);
  const filePath = path.join(fixture, 'docs/index.md');
  fs.appendFileSync(filePath, [
    '',
    "<figure id='figure-99-1' class='book-figure'>",
    '  <img',
    "    src='{{ \"/assets/images/diagrams/chapter01/osi-tcp-ip-comparison.svg\" | relative_url }}'",
    "    alt='図99-1: 本文の正規図版ではない旧候補SVG'",
    "    loading='lazy'",
    "    decoding='async'>",
    '  <figcaption>図99-1: 余分な図版</figcaption>',
    '</figure>',
    '',
  ].join('\n'));
  assert.throws(() => validateFigureIndex(fixture), /public numbered SVG count: expected 15, got 16/);
});

test('index link to an unreferenced asset is rejected', (t) => {
  const fixture = makeFixture(t);
  copy('docs/assets/images/diagrams/chapter01/osi-tcp-ip-comparison.svg', fixture);
  mutateBothIndexes(fixture, (text) => text.replace(
    '../../chapters/chapter01/#figure-1-1',
    '../../assets/images/diagrams/chapter01/osi-tcp-ip-comparison.svg',
  ));
  assert.throws(() => validateFigureIndex(fixture), /entry 1 href: expected \.\.\/\.\.\/chapters\/chapter01\/#figure-1-1/);
});

test('missing index entry is rejected', (t) => {
  const fixture = makeFixture(t);
  mutateBothIndexes(fixture, (text) => text.replace(
    '### [図1-1: OSI参照モデルとTCP/IPモデルの比較]',
    '#### [図1-1: OSI参照モデルとTCP/IPモデルの比較]',
  ));
  assert.throws(() => validateFigureIndex(fixture), /index count: expected 15, got 14/);
});

test('duplicate index entry is rejected', (t) => {
  const fixture = makeFixture(t);
  mutateBothIndexes(fixture, (text) => {
    const start = text.indexOf('### [図1-1:');
    const end = text.indexOf('\n### [図1-2:', start);
    assert.ok(start >= 0 && end > start);
    const block = text.slice(start, end);
    return `${text.slice(0, end)}\n${block}${text.slice(end)}`;
  });
  assert.throws(() => validateFigureIndex(fixture), /index count: expected 15, got 16/);
});

test('extra index entry is rejected', (t) => {
  const fixture = makeFixture(t);
  mutateBothIndexes(fixture, (text) => text.replace('## 次に読む', [
    '### [図99-1: 余分な図版](../../chapters/chapter13/#figure-99-1)',
    '',
    '- **掲載章:** 第13章「技術選択のフレームワーク」',
    '- **目的:** 正規の15図に含まれない項目。',
    '- **確認観点:** 余分な項目を検出できるか。',
    '',
    '## 次に読む',
  ].join('\n')));
  assert.throws(() => validateFigureIndex(fixture), /index count: expected 15, got 16/);
});
