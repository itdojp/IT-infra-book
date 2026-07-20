#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

class ReadingGuideContractError extends Error {}

const indexPath = 'docs/index.md';
const startHeading = '## 読み方ガイド';
const requiredRoutes = [
  'chapters/chapter01/',
  'chapters/chapter02/',
  'chapters/chapter03/',
  'chapters/chapter04/',
  'chapters/chapter05/',
  'chapters/chapter06/',
  'chapters/chapter07/',
  'chapters/chapter08/',
];
const requiredMarkers = [
  'プロトコルスタック、L2、L3のネットワーク基礎',
  '（OS内部構造）',
  '（ストレージ）',
  '（仮想化/コンテナ）',
  '仮想化/コンテナは、第6章を読んでから第8章へ進む',
];
const obsoleteClaim = 'プロトコルスタックとOS/仮想化の関係を俯瞰';

function readRequired(root, relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new ReadingGuideContractError(`required file is missing: ${relativePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function extractGuide(text) {
  const start = text.indexOf(startHeading);
  if (start < 0) throw new ReadingGuideContractError(`missing ${startHeading} in ${indexPath}`);
  const end = text.indexOf('\n## ', start + startHeading.length);
  if (end < 0) throw new ReadingGuideContractError(`${startHeading} has no following level-2 section`);
  return text.slice(start, end);
}

function markdownLinks(text) {
  return [...text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
}

function overviewPath(guide) {
  const start = guide.indexOf('\n- ');
  if (start < 0) throw new ReadingGuideContractError('reading guide has no overview path');
  const end = guide.indexOf('\n- ', start + 3);
  if (end < 0) throw new ReadingGuideContractError('reading guide has no second audience path');
  return guide.slice(start, end);
}

function validateLocalTargets(root, links) {
  const docsRoot = path.resolve(root, 'docs');
  for (const href of links) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) continue;
    const clean = href.split('#', 1)[0].split('?', 1)[0];
    let decoded;
    try {
      decoded = decodeURIComponent(clean);
    } catch {
      throw new ReadingGuideContractError(`reading-guide link has invalid percent encoding: ${href}`);
    }
    const relativeTarget = decoded.endsWith('/') ? `${decoded}index.md` : decoded;
    const segments = relativeTarget.split('/');
    if (
      path.isAbsolute(relativeTarget)
      || relativeTarget.includes('\\')
      || segments.some((segment) => segment === '.' || segment === '..')
    ) {
      throw new ReadingGuideContractError(`reading-guide link is not a safe docs-relative path: ${href}`);
    }
    const target = path.resolve(docsRoot, relativeTarget);
    const relative = path.relative(docsRoot, target);
    if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
      throw new ReadingGuideContractError(`reading-guide link escapes the published docs tree: ${href}`);
    }
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
      throw new ReadingGuideContractError(`reading-guide link has no published target: ${href}`);
    }
  }
}

function validateReadingGuide(root) {
  const guide = extractGuide(readRequired(root, indexPath));

  if (guide.includes(obsoleteClaim)) {
    throw new ReadingGuideContractError(`obsolete reading-guide claim remains: ${obsoleteClaim}`);
  }
  for (const marker of requiredMarkers) {
    if (!guide.includes(marker)) {
      throw new ReadingGuideContractError(`reading guide is missing required marker: ${marker}`);
    }
  }

  const overview = overviewPath(guide);
  let previous = -1;
  for (const route of requiredRoutes) {
    const current = overview.indexOf(`](${route})`, previous + 1);
    if (current < 0) {
      throw new ReadingGuideContractError(`overview route is missing or out of order: ${route}`);
    }
    previous = current;
  }

  const links = markdownLinks(guide);
  validateLocalTargets(root, links);
  const bulletCount = (guide.match(/^- /gm) || []).length;
  if (bulletCount < 5) {
    throw new ReadingGuideContractError(`reading guide must retain at least 5 audience paths, got ${bulletCount}`);
  }

  return { bulletCount, linkCount: links.length };
}

if (require.main === module) {
  try {
    const result = validateReadingGuide(path.resolve(__dirname, '..'));
    console.log(`OK: reading guide matches chapter topics and order (${result.bulletCount} paths, ${result.linkCount} links)`);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { ReadingGuideContractError, validateReadingGuide };
