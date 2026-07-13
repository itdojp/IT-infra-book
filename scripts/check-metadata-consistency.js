#!/usr/bin/env node
'use strict';

/**
 * Validate public metadata and navigation coverage without third-party deps.
 * The repository publishes `docs/`; this check keeps package metadata,
 * book-config, Jekyll config, top-page front matter, navigation, structure
 * routes, and required public assets aligned before GitHub Pages publishes.
 */

const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');
const { validateFigureIndex } = require('./check-figure-index');

const root = path.resolve(__dirname, '..');
const docs = path.join(root, 'docs');

const expected = {
  packageName: 'it-infra-book',
  title: 'ITインフラストラクチャ技術ガイド',
  subtitle: 'ネットワークとサーバーシステムの設計と実装',
  description: 'ベンダー非依存の観点からインフラストラクチャ技術の本質的な設計原理と実装手法を体系化した技術書',
  author: '太田和彦（株式会社アイティードゥ）',
  version: '1.0.1',
  license: 'CC-BY-NC-SA-4.0',
  lang: 'ja',
  url: 'https://itdojp.github.io',
  baseurl: '/IT-infra-book',
  homepage: 'https://itdojp.github.io/IT-infra-book/',
  repositoryFull: 'itdojp/IT-infra-book',
  repositoryUrl: 'https://github.com/itdojp/IT-infra-book',
  repositoryGit: 'git+https://github.com/itdojp/IT-infra-book.git',
};

const requiredNavSections = ['introduction', 'chapters', 'appendices', 'afterword'];
const supportedNavSections = ['introduction', 'chapters', 'additional', 'resources', 'appendices', 'afterword'];
const requiredAssets = [
  'assets/css/main.css',
  'assets/css/syntax-highlighting.css',
  'assets/js/theme.js',
  'assets/js/search.js',
  'assets/js/code-copy-lightweight.js',
  'assets/images/itdo_logo_48x48_blue.png',
];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function rel(filePath) {
  return path.relative(root, filePath) || '.';
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`failed to read JSON ${rel(filePath)}: ${error.message}`);
  }
}

function stripQuotes(value) {
  const trimmed = String(value || '').trim();
  if (trimmed.length >= 2 && trimmed[0] === trimmed[trimmed.length - 1] && ['"', "'"].includes(trimmed[0])) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readSimpleYamlScalars(filePath) {
  if (!fs.existsSync(filePath)) fail(`required file is missing: ${rel(filePath)}`);
  const result = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!rawLine || /^[ \t#]/.test(rawLine) || !rawLine.includes(':')) continue;
    const [key, ...valueParts] = rawLine.split(':');
    const value = valueParts.join(':').trim();
    if (!key.trim() || !value || ['|', '>'].includes(value)) continue;
    result[key.trim()] = stripQuotes(value.replace(/\s+#.*$/, ''));
  }
  return result;
}

function parseFrontMatter(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  if (lines[0] !== '---') fail(`${rel(filePath)} is missing YAML front matter`);
  const end = lines.indexOf('---', 1);
  if (end < 0) fail(`${rel(filePath)} has no closing front matter delimiter`);
  const result = {};
  for (const rawLine of lines.slice(1, end)) {
    if (!rawLine || /^[ \t#]/.test(rawLine) || !rawLine.includes(':')) continue;
    const [key, ...valueParts] = rawLine.split(':');
    result[key.trim()] = stripQuotes(valueParts.join(':').trim());
  }
  return result;
}

function normalizePath(value) {
  if (typeof value !== 'string') return null;
  let route = value.trim();
  if (!route || /^(https?:|mailto:)/.test(route)) return null;
  if (!route.startsWith('/')) route = `/${route}`;
  const lower = route.toLowerCase();
  if (/\.(md|html?|pdf|txt)$/.test(lower)) return route;
  return route.endsWith('/') ? route : `${route}/`;
}

function assertSafePath(route, label) {
  if (!route.startsWith('/')) fail(`${label} must start with '/': ${route}`);
  if (route.includes('\\')) fail(`${label} contains a backslash: ${route}`);
  if (route.includes('//')) fail(`${label} contains duplicate slashes: ${route}`);
  if (route.split('/').filter(Boolean).some((part) => part === '.' || part === '..')) {
    fail(`${label} contains an unsafe segment: ${route}`);
  }
}

function readNavigation(filePath) {
  if (!fs.existsSync(filePath)) fail(`required file is missing: ${rel(filePath)}`);
  const sections = Object.fromEntries(supportedNavSections.map((section) => [section, []]));
  let currentSection = null;
  let currentItem = null;
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    const stripped = line.trim();
    if (!stripped || stripped.startsWith('#')) continue;
    if (!/^[ \t]/.test(line) && stripped.endsWith(':')) {
      currentSection = stripped.slice(0, -1);
      currentItem = null;
      continue;
    }
    if (!supportedNavSections.includes(currentSection)) continue;
    let content = stripped;
    if (content.startsWith('- ')) {
      currentItem = {};
      sections[currentSection].push(currentItem);
      content = content.slice(2).trim();
      if (!content) continue;
    }
    if (!currentItem || !content.includes(':')) continue;
    const [key, ...valueParts] = content.split(':');
    currentItem[key.trim()] = stripQuotes(valueParts.join(':').trim());
  }
  return sections;
}

function markdownRoute(filePath) {
  const frontMatter = parseFrontMatter(filePath);
  const permalink = normalizePath(frontMatter.permalink);
  if (permalink) return permalink;
  const relPath = path.relative(docs, filePath).split(path.sep).join('/');
  if (relPath === 'index.md') return '/';
  if (relPath.endsWith('/index.md')) return `/${relPath.slice(0, -'index.md'.length)}`;
  return `/${relPath.replace(/\.md$/, '')}/`;
}

function listMarkdownFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_') || entry.name === 'assets') continue;
      out.push(...listMarkdownFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function assertEqual(actual, expectedValue, label) {
  if (actual !== expectedValue) {
    fail(`${label} mismatch: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actual)}`);
  }
}

function checkBookConfig(bookConfig) {
  for (const key of ['title', 'subtitle', 'description', 'author', 'version', 'language', 'license', 'homepage']) {
    assertEqual(bookConfig[key], expected[key === 'language' ? 'lang' : key], `book-config.json.${key}`);
  }
  assertEqual(bookConfig.repository && bookConfig.repository.url, expected.repositoryUrl, 'book-config.json.repository.url');
  assertEqual(bookConfig.repository && bookConfig.repository.branch, 'main', 'book-config.json.repository.branch');
  const chapters = (bookConfig.structure && bookConfig.structure.chapters) || [];
  const appendices = (bookConfig.structure && bookConfig.structure.appendices) || [];
  if (!chapters.length) fail('book-config.json.structure.chapters must not be empty');
  if (!appendices.length) fail('book-config.json.structure.appendices must not be empty');
  for (const [index, item] of [...chapters, ...appendices].entries()) {
    if (!item.id || !item.title || !item.path) fail(`book-config.json.structure item ${index + 1} must include id/title/path`);
    const route = normalizePath(item.path);
    if (!route) fail(`book-config.json.structure item ${item.id}.path must be a local route: ${JSON.stringify(item.path)}`);
    assertSafePath(route, `book-config.json.structure item ${item.id}.path`);
  }
}

function checkMetadata(bookConfig, packageJson, packageLock) {
  checkBookConfig(bookConfig);
  assertEqual(packageJson.name, expected.packageName, 'package.json.name');
  for (const key of ['description', 'version', 'author', 'license']) {
    assertEqual(packageJson[key], expected[key], `package.json.${key}`);
  }
  assertEqual(packageJson.repository && packageJson.repository.type, 'git', 'package.json.repository.type');
  assertEqual(packageJson.repository && packageJson.repository.url, expected.repositoryGit, 'package.json.repository.url');
  assertEqual(packageJson.homepage, expected.homepage, 'package.json.homepage');
  assertEqual(packageJson.bugs && packageJson.bugs.url, `${expected.repositoryUrl}/issues`, 'package.json.bugs.url');
  assertEqual(packageJson.scripts && packageJson.scripts['check:metadata'], 'node scripts/check-metadata-consistency.js', 'package.json.scripts.check:metadata');
  if (!String(packageJson.scripts && packageJson.scripts.test || '').includes('npm run check:metadata')) {
    fail('package.json.scripts.test must run npm run check:metadata');
  }
  assertEqual(packageLock.name, expected.packageName, 'package-lock.json.name');
  assertEqual(packageLock.version, expected.version, 'package-lock.json.version');
  assertEqual(packageLock.packages && packageLock.packages[''] && packageLock.packages[''].name, expected.packageName, 'package-lock.json.packages[""].name');
  assertEqual(packageLock.packages && packageLock.packages[''] && packageLock.packages[''].version, expected.version, 'package-lock.json.packages[""].version');

  const jekyll = readSimpleYamlScalars(path.join(docs, '_config.yml'));
  for (const key of ['title', 'description', 'author', 'version', 'license', 'lang', 'url', 'baseurl', 'homepage']) {
    assertEqual(jekyll[key], expected[key], `docs/_config.yml.${key}`);
  }
  assertEqual(jekyll.repository, expected.repositoryFull, 'docs/_config.yml.repository');
  assertEqual(jekyll.repository_url, expected.repositoryUrl, 'docs/_config.yml.repository_url');

  const indexFrontMatter = parseFrontMatter(path.join(docs, 'index.md'));
  for (const key of ['title', 'description', 'author', 'version']) {
    assertEqual(indexFrontMatter[key], expected[key], `docs/index.md front matter ${key}`);
  }
}

function checkNavigation(bookConfig, navSectionsData) {
  const publishedRoutes = new Map();
  for (const filePath of listMarkdownFiles(docs)) {
    const route = markdownRoute(filePath);
    assertSafePath(route, `published route for ${rel(filePath)}`);
    if (publishedRoutes.has(route)) {
      fail(`duplicate published route ${route}: ${rel(publishedRoutes.get(route))} and ${rel(filePath)}`);
    }
    publishedRoutes.set(route, filePath);
  }

  const navRoutes = [];
  const seen = new Map();
  for (const section of requiredNavSections) {
    if (!(navSectionsData[section] || []).length) fail(`navigation.${section} has no items`);
  }
  for (const section of supportedNavSections) {
    const items = navSectionsData[section] || [];
    for (const [index, item] of items.entries()) {
      const route = normalizePath(item.path);
      if (!item.title || !route) fail(`navigation.${section}[${index + 1}] is missing title or path`);
      assertSafePath(route, `navigation.${section}[${index + 1}].path`);
      if (seen.has(route)) fail(`duplicate navigation path ${route}: ${seen.get(route)} and ${item.title}`);
      seen.set(route, item.title);
      if (!publishedRoutes.has(route)) fail(`navigation path has no docs page: ${route}`);
      navRoutes.push(route);
    }
  }

  const expectedRoutes = [...publishedRoutes.keys()].filter((route) => route !== '/').sort();
  const actualRoutes = [...navRoutes].sort();
  const missing = expectedRoutes.filter((route) => !actualRoutes.includes(route));
  const extra = actualRoutes.filter((route) => !expectedRoutes.includes(route));
  if (missing.length || extra.length) {
    fail(`navigation/docs route mismatch: missing=${JSON.stringify(missing)}, extra=${JSON.stringify(extra)}`);
  }

  const structureItems = [
    ...((bookConfig.structure && bookConfig.structure.chapters) || []),
    ...((bookConfig.structure && bookConfig.structure.appendices) || []),
  ];
  const structureRoutes = [];
  for (const item of structureItems) {
    const route = normalizePath(item.path);
    if (!route) fail(`book-config structure item ${item.id || item.title} is missing path`);
    if (!publishedRoutes.has(route)) fail(`book-config structure route has no docs page: ${route}`);
    if (!seen.has(route)) fail(`book-config structure route is missing from navigation: ${route}`);
    const navTitle = seen.get(route);
    if (navTitle !== item.title) fail(`book-config title mismatch for ${route}: expected navigation title ${JSON.stringify(navTitle)}, got ${JSON.stringify(item.title)}`);
    structureRoutes.push(route);
  }
  const requiredStructureRoutes = actualRoutes.filter((route) => route.startsWith('/chapters/') || route.startsWith('/appendices/')).sort();
  const actualStructureRoutes = [...new Set(structureRoutes)].sort();
  if (!isDeepStrictEqual(actualStructureRoutes, requiredStructureRoutes)) {
    fail(`book-config/docs route mismatch: expected=${JSON.stringify(requiredStructureRoutes)}, got=${JSON.stringify(actualStructureRoutes)}`);
  }

  return { pageCount: publishedRoutes.size, navCount: navRoutes.length };
}

function checkAssets() {
  const missing = requiredAssets.filter((asset) => {
    const filePath = path.join(docs, asset);
    return !fs.existsSync(filePath) || !fs.statSync(filePath).isFile() || fs.statSync(filePath).size === 0;
  });
  if (missing.length) fail(`required public assets are missing or empty: ${missing.join(', ')}`);
}

const bookConfig = readJson(path.join(root, 'book-config.json'));
const packageJson = readJson(path.join(root, 'package.json'));
const packageLock = readJson(path.join(root, 'package-lock.json'));
const navigation = readNavigation(path.join(docs, '_data', 'navigation.yml'));

checkMetadata(bookConfig, packageJson, packageLock);
const counts = checkNavigation(bookConfig, navigation);
checkAssets();
let figureCounts;
try {
  figureCounts = validateFigureIndex(root);
} catch (error) {
  fail(error && error.message ? error.message : String(error));
}
console.log(`OK: metadata and navigation coverage are consistent (${counts.navCount} navigation entries, ${counts.pageCount} docs pages)`);
console.log(`OK: figure-index coverage is consistent (${figureCounts.figureCount} bidirectional figure mappings)`);
