#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

class StandbyContractError extends Error {}

const sourcePath = 'src/chapters/chapter11/index.md';
const publishedPath = 'docs/chapters/chapter11/index.md';
const startHeading = '#### コールドスタンバイ';
const endHeading = '#### ウォームスタンバイ';

const requiredMarkers = [
  'PostgreSQL 12以降',
  'サポート中のPostgreSQL 14〜18',
  '最新のマイナー版',
  '同じメジャー版',
  '`LOGIN`と`REPLICATION`',
  '`pg_hba.conf`',
  '`max_wal_senders`',
  '権限`0600`の`.pgpass`',
  '--write-recovery-conf',
  'standby.signal',
  'postgresql.auto.conf',
  'primary_conninfo',
  'WALアーカイブまたは物理レプリケーションスロット',
  '障害側プライマリを隔離',
  'https://www.postgresql.org/docs/release/12.0/',
  'https://www.postgresql.org/docs/18/app-pgbasebackup.html',
  'https://www.postgresql.org/docs/18/warm-standby.html',
  'https://www.postgresql.org/support/versioning/',
];

function readFile(root, relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new StandbyContractError(`required file is missing: ${relativePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function extractSection(text, relativePath) {
  const start = text.indexOf(startHeading);
  if (start < 0) {
    throw new StandbyContractError(`${relativePath}: missing ${startHeading}`);
  }
  const end = text.indexOf(endHeading, start + startHeading.length);
  if (end < 0) {
    throw new StandbyContractError(`${relativePath}: missing ${endHeading} after cold-standby section`);
  }
  return text.slice(start, end);
}

function fencedCode(section) {
  return [...section.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1]).join('\n');
}

function assertMarkers(section) {
  for (const marker of requiredMarkers) {
    if (!section.includes(marker)) {
      throw new StandbyContractError(`cold-standby section is missing required marker: ${marker}`);
    }
  }
}

function assertOrder(section, markers) {
  let previous = -1;
  for (const marker of markers) {
    const current = section.indexOf(marker, previous + 1);
    if (current < 0) {
      throw new StandbyContractError(`cold-standby section is missing ordered marker: ${marker}`);
    }
    if (current <= previous) {
      throw new StandbyContractError(`cold-standby marker is out of order: ${marker}`);
    }
    previous = current;
  }
}

function validateStandbyContract(root) {
  const source = extractSection(readFile(root, sourcePath), sourcePath);
  const published = extractSection(readFile(root, publishedPath), publishedPath);

  if (source !== published) {
    throw new StandbyContractError('source/public cold-standby sections are not byte-identical');
  }

  assertMarkers(source);
  assertOrder(source, [
    'PostgreSQLサービスを停止',
    'pg_basebackup \\',
    'test -f "$PGDATA/standby.signal"',
    "grep -Fq 'primary_conninfo' \"$PGDATA/postgresql.auto.conf\"",
  ]);

  const code = fencedCode(source);
  if (!code.includes('pg_basebackup \\')) {
    throw new StandbyContractError('cold-standby section has no executable pg_basebackup example');
  }
  if (/recovery\.conf/.test(code) || /standby_mode\s*=/.test(code)) {
    throw new StandbyContractError('obsolete recovery.conf/standby_mode command is present in executable code');
  }

  return {
    source: sourcePath,
    published: publishedPath,
    sectionBytes: Buffer.byteLength(source, 'utf8'),
  };
}

if (require.main === module) {
  try {
    const root = path.resolve(__dirname, '..');
    const result = validateStandbyContract(root);
    console.log(`OK: PostgreSQL standby contract is current and synchronized (${result.sectionBytes} bytes)`);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { StandbyContractError, validateStandbyContract };
