'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { validateStandbyContract } = require('./check-postgresql-standby');

const repoRoot = path.resolve(__dirname, '..');
const scratchRoot = path.join(repoRoot, '.codex-local', 'tmp');
const chapterPaths = [
  'src/chapters/chapter11/index.md',
  'docs/chapters/chapter11/index.md',
];

function makeFixture(t) {
  fs.mkdirSync(scratchRoot, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(scratchRoot, 'postgresql-standby-test-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  for (const relativePath of chapterPaths) {
    const target = path.join(fixture, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, relativePath), target);
  }
  return fixture;
}

function replaceRequired(root, relativePath, search, replacement) {
  const filePath = path.join(root, relativePath);
  const original = fs.readFileSync(filePath, 'utf8');
  assert.ok(original.includes(search), `mutation source not found in ${relativePath}: ${search}`);
  fs.writeFileSync(filePath, original.replace(search, replacement));
}

function mutateBoth(root, search, replacement) {
  for (const relativePath of chapterPaths) {
    replaceRequired(root, relativePath, search, replacement);
  }
}

function replaceAllRequired(root, relativePath, search, replacement) {
  const filePath = path.join(root, relativePath);
  const original = fs.readFileSync(filePath, 'utf8');
  assert.ok(original.includes(search), `mutation source not found in ${relativePath}: ${search}`);
  fs.writeFileSync(filePath, original.split(search).join(replacement));
}

function mutateAllInBoth(root, search, replacement) {
  for (const relativePath of chapterPaths) {
    replaceAllRequired(root, relativePath, search, replacement);
  }
}

test('canonical source and published chapter satisfy the PostgreSQL 12+ contract', () => {
  const result = validateStandbyContract(repoRoot);
  assert.equal(result.source, chapterPaths[0]);
  assert.equal(result.published, chapterPaths[1]);
  assert.ok(result.sectionBytes > 0);
});

test('source/public drift is rejected', (t) => {
  const fixture = makeFixture(t);
  replaceRequired(fixture, chapterPaths[1], '同じメジャー版', '同一major version');
  assert.throws(() => validateStandbyContract(fixture), /not byte-identical/);
});

test('missing PostgreSQL 12+ target is rejected', (t) => {
  const fixture = makeFixture(t);
  mutateAllInBoth(fixture, 'PostgreSQL 12以降', '対象version未定');
  assert.throws(() => validateStandbyContract(fixture), /missing required marker: PostgreSQL 12以降/);
});

test('missing supported production versions are rejected', (t) => {
  const fixture = makeFixture(t);
  mutateBoth(fixture, 'サポート中のPostgreSQL 14〜18', 'サポート中の版');
  assert.throws(() => validateStandbyContract(fixture), /missing required marker: サポート中のPostgreSQL 14〜18/);
});

test('missing write-recovery-conf command is rejected', (t) => {
  const fixture = makeFixture(t);
  mutateAllInBoth(fixture, '--write-recovery-conf', '--no-write-recovery-conf');
  assert.throws(() => validateStandbyContract(fixture), /missing required marker: --write-recovery-conf/);
});

test('obsolete recovery.conf command is rejected even when source and docs match', (t) => {
  const fixture = makeFixture(t);
  mutateBoth(
    fixture,
    'test -f "$PGDATA/standby.signal"',
    'test -f "$PGDATA/standby.signal"\necho "standby_mode = on" >> "$PGDATA/recovery.conf"',
  );
  assert.throws(() => validateStandbyContract(fixture), /obsolete recovery\.conf\/standby_mode command/);
});

test('missing primary isolation boundary is rejected', (t) => {
  const fixture = makeFixture(t);
  mutateBoth(fixture, '障害側プライマリを隔離', '障害側を確認');
  assert.throws(() => validateStandbyContract(fixture), /missing required marker: 障害側プライマリを隔離/);
});

test('missing versioned official pg_basebackup source is rejected', (t) => {
  const fixture = makeFixture(t);
  mutateBoth(
    fixture,
    'https://www.postgresql.org/docs/18/app-pgbasebackup.html',
    'https://example.invalid/pgbasebackup',
  );
  assert.throws(() => validateStandbyContract(fixture), /missing required marker: https:\/\/www\.postgresql\.org\/docs\/18\/app-pgbasebackup\.html/);
});
