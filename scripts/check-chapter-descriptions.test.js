'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  chapterContracts,
  parseJsonRequired,
  validateChapterDescriptionContracts,
  validateChapterDescriptions,
} = require('./check-chapter-descriptions');

const repoRoot = path.resolve(__dirname, '..');

function canonicalInput() {
  const bookConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'book-config.json'), 'utf8'));
  const publishedChapters = Object.fromEntries(chapterContracts.map(({ id }) => [
    id,
    fs.readFileSync(path.join(repoRoot, 'docs', 'chapters', id, 'index.md'), 'utf8'),
  ]));
  return { bookConfig, publishedChapters };
}

test('accepts all canonical chapter descriptions and purpose markers', () => {
  const { bookConfig, publishedChapters } = canonicalInput();
  assert.deepEqual(validateChapterDescriptionContracts(bookConfig, publishedChapters), { chapterCount: 13 });
});

test('rejects a description copied from another chapter theme', () => {
  const { bookConfig, publishedChapters } = canonicalInput();
  bookConfig.structure.chapters[1].description = 'TCP/IPから現代ネットワークまでの実装技術';
  assert.throws(
    () => validateChapterDescriptionContracts(bookConfig, publishedChapters),
    /chapter02 description mismatch/,
  );
});

test('rejects a description contract not supported by the published purpose', () => {
  const { bookConfig, publishedChapters } = canonicalInput();
  publishedChapters.chapter05 = publishedChapters.chapter05.replaceAll('TLS実装', '暗号化実装');
  assert.throws(
    () => validateChapterDescriptionContracts(bookConfig, publishedChapters),
    /chapter05 purpose is missing marker "TLS実装"/,
  );
});

test('rejects chapter order drift', () => {
  const { bookConfig, publishedChapters } = canonicalInput();
  [bookConfig.structure.chapters[2], bookConfig.structure.chapters[3]] = [
    bookConfig.structure.chapters[3],
    bookConfig.structure.chapters[2],
  ];
  assert.throws(
    () => validateChapterDescriptionContracts(bookConfig, publishedChapters),
    /chapter order mismatch at 3/,
  );
});

test('reports a missing contract input with a stable domain error', () => {
  assert.throws(
    () => validateChapterDescriptions(path.join(repoRoot, '.codex-local', 'missing-chapter-description-root')),
    /required file is missing: book-config\.json/,
  );
});

test('reports malformed book metadata with a stable domain error', () => {
  assert.throws(
    () => parseJsonRequired('{', 'book-config.json'),
    /invalid JSON in book-config\.json/,
  );
});
