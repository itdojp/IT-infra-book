#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const EXPECTED_FIGURE_NUMBERS = [
  '図1-1', '図1-2', '図1-3',
  '図2-1', '図2-2', '図2-3',
  '図11-1', '図11-2', '図11-3',
  '図12-1', '図12-2', '図12-3',
  '図13-1', '図13-2', '図13-3',
];
const FIGURE_INDEX_ROUTE = '/appendices/figure-index/';

class FigureIndexValidationError extends Error {
  constructor(issues) {
    super(`figure index validation failed:\n- ${issues.join('\n- ')}`);
    this.name = 'FigureIndexValidationError';
    this.issues = issues;
  }
}

function readText(filePath, issues, label = filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    issues.push(`${label} is missing or unreadable: ${error.message}`);
    return '';
  }
}

function readJson(filePath, issues, label = filePath) {
  const text = readText(filePath, issues, label);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    issues.push(`${label} is invalid JSON: ${error.message}`);
    return null;
  }
}

function walkMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '_site' || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkMarkdown(fullPath));
    if (entry.isFile() && entry.name.endsWith('.md') && entry.name.toLowerCase() !== 'readme.md') files.push(fullPath);
  }
  return files.sort();
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function duplicates(values) {
  const seen = new Set();
  const duplicateValues = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicateValues.add(value);
    seen.add(value);
  }
  return [...duplicateValues];
}

function stripFrontMatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim();
}

function parseFrontMatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 0 || /^\s/.test(line)) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    data[key] = value;
  }
  return data;
}

function parseNavigationItems(text, section) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${section}:`);
  if (start < 0) return [];
  const items = [];
  let current = null;
  for (const line of lines.slice(start + 1)) {
    if (line && !/^\s/.test(line) && /^[\w-]+:$/.test(line)) break;
    const itemStart = line.match(/^-\s+title:\s*(.+)$/);
    if (itemStart) {
      current = { title: itemStart[1].trim().replace(/^(['"])(.*)\1$/, '$2') };
      items.push(current);
      continue;
    }
    const itemPath = line.match(/^\s+path:\s*(.+)$/);
    if (current && itemPath) current.path = itemPath[1].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return items;
}

function parseAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*"([^"]*)"/g)) attributes[match[1]] = match[2];
  return attributes;
}

function extractAsset(value) {
  const match = String(value || '').match(/(\/assets\/[^'"}\s]+\.svg)/);
  return match ? match[1] : null;
}

function extractSourceFigures(text, file) {
  const records = [];
  const pattern = /<span\s+id="(figure-\d+-\d+)"\s+class="figure-anchor"><\/span>\s*\n+\[(図\d+-\d+): ([^\]\n]+)\]\s*\n```mermaid\s*\n/g;
  for (const match of text.matchAll(pattern)) {
    records.push({ id: match[1], number: match[2], title: match[3], file, position: match.index });
  }
  return records;
}

function extractPublicFigures(text, file) {
  const records = [];
  const markdownPattern = /!\[(図\d+-\d+): ([^\]\n]+)\]\(([^)\n]+\.svg[^)\n]*)\)\\\n\*(図\d+-\d+): ([^*\n]+)\*\s*\n\{:\s+#(figure-\d+-\d+)\s+\.book-figure\s*\}/g;
  for (const match of text.matchAll(markdownPattern)) {
    records.push({
      id: match[6],
      number: match[4],
      title: match[5],
      asset: extractAsset(match[3]),
      alt: `${match[1]}: ${match[2]}`,
      file,
      position: match.index,
    });
  }

  // Also discover numbered raw-HTML figures so an extra legacy/public figure
  // cannot evade the exact-count gate.
  const pattern = /<figure\b([^>]*)>([\s\S]*?)<\/figure>/g;
  for (const match of text.matchAll(pattern)) {
    const figureAttributes = parseAttributes(match[1]);
    if (!/^figure-\d+-\d+$/.test(figureAttributes.id || '')) continue;
    const imageMatch = match[2].match(/<img\b[\s\S]*?>/);
    const captionMatch = match[2].match(/<figcaption>(図\d+-\d+): ([^<\n]+)<\/figcaption>/);
    const imageAttributes = imageMatch ? parseAttributes(imageMatch[0]) : {};
    records.push({
      id: figureAttributes.id,
      number: captionMatch && captionMatch[1],
      title: captionMatch && captionMatch[2],
      asset: extractAsset(imageAttributes.src),
      alt: imageAttributes.alt,
      file,
      position: match.index,
    });
  }
  return records;
}

function extractNumberedSvgImages(text, file) {
  const records = [];
  for (const match of text.matchAll(/<img\b[\s\S]*?>/g)) {
    const attributes = parseAttributes(match[0]);
    if (!/^図\d+-\d+:\s+/.test(attributes.alt || '')) continue;
    records.push({ alt: attributes.alt, asset: extractAsset(attributes.src), file, position: match.index });
  }
  for (const match of text.matchAll(/!\[(図\d+-\d+):\s+([^\]]+)\]\(([^)]+\.svg[^)]*)\)/g)) {
    records.push({ alt: `${match[1]}: ${match[2]}`, asset: extractAsset(match[3]), file, position: match.index });
  }
  return records;
}

function extractIndexEntries(text) {
  const records = [];
  const pattern = /^### \[(図\d+-\d+): ([^\]]+)\]\(([^)]+)\)\s*\n+\s*\n- \*\*掲載章:\*\* ([^\n]+)\n- \*\*目的:\*\* ([^\n]+)\n- \*\*確認観点:\*\* ([^\n]+)/gm;
  for (const match of text.matchAll(pattern)) {
    records.push({
      number: match[1], title: match[2], href: match[3], chapter: match[4],
      purpose: match[5], reviewPoint: match[6], position: match.index,
    });
  }
  return records;
}

function assertExactRecordSet(actual, manifest, kind, issues) {
  if (actual.length !== manifest.length) issues.push(`${kind} count: expected ${manifest.length}, got ${actual.length}`);
  for (const key of ['id', 'number']) {
    const duplicateValues = duplicates(actual.map((item) => item[key]).filter(Boolean));
    if (duplicateValues.length) issues.push(`${kind} has duplicate ${key}: ${duplicateValues.join(', ')}`);
  }
  const expectedIds = new Set(manifest.map((item) => item.id));
  const unexpected = actual.filter((item) => !expectedIds.has(item.id)).map((item) => item.id || item.number || '(unknown)');
  if (unexpected.length) issues.push(`${kind} has extra records: ${unexpected.join(', ')}`);
  for (const figure of manifest) {
    const matches = actual.filter((item) => item.id === figure.id);
    if (matches.length !== 1) issues.push(`${kind} ${figure.id}: expected exactly one record, got ${matches.length}`);
  }
}

function validateManifest(manifest, issues) {
  if (!Array.isArray(manifest)) {
    issues.push('figure-index.json must contain an array');
    return [];
  }
  if (manifest.length !== EXPECTED_FIGURE_NUMBERS.length) {
    issues.push(`manifest count: expected ${EXPECTED_FIGURE_NUMBERS.length}, got ${manifest.length}`);
  }
  const numbers = manifest.map((item) => item && item.number);
  if (JSON.stringify(numbers) !== JSON.stringify(EXPECTED_FIGURE_NUMBERS)) {
    issues.push(`manifest body order mismatch: expected ${EXPECTED_FIGURE_NUMBERS.join(', ')}, got ${numbers.join(', ')}`);
  }
  const requiredFields = [
    'id', 'number', 'title', 'chapterLabel', 'chapterTitle', 'chapterPath', 'source', 'public',
    'asset', 'alt', 'purpose', 'reviewPoint',
  ];
  for (const [index, figure] of manifest.entries()) {
    if (!figure || typeof figure !== 'object') {
      issues.push(`manifest entry ${index + 1} must be an object`);
      continue;
    }
    for (const field of requiredFields) {
      if (typeof figure[field] !== 'string' || !figure[field].trim()) {
        issues.push(`manifest entry ${index + 1} is missing ${field}`);
      }
    }
    const expectedId = `figure-${String(figure.number || '').replace(/^図/, '')}`;
    if (figure.id !== expectedId) issues.push(`manifest ${figure.number || index + 1} id: expected ${expectedId}, got ${figure.id}`);
    if (!/^\/chapters\/chapter\d{2}\/$/.test(figure.chapterPath || '')) issues.push(`manifest ${figure.id} has invalid chapterPath`);
    if (!/^src\/chapters\/chapter\d{2}\/index\.md$/.test(figure.source || '')) issues.push(`manifest ${figure.id} has invalid source path`);
    if (!/^docs\/chapters\/chapter\d{2}\/index\.md$/.test(figure.public || '')) issues.push(`manifest ${figure.id} has invalid public path`);
    if (!/^\/assets\/images\/diagrams\/chapter\d{2}\/[a-z0-9-]+\.svg$/.test(figure.asset || '')) issues.push(`manifest ${figure.id} has invalid asset path`);
  }
  for (const field of ['id', 'number', 'asset']) {
    const duplicateValues = duplicates(manifest.map((item) => item && item[field]).filter(Boolean));
    if (duplicateValues.length) issues.push(`manifest has duplicate ${field}: ${duplicateValues.join(', ')}`);
  }
  return manifest.filter((item) => item && typeof item === 'object');
}

function validateConfiguration(repoRoot, manifest, issues) {
  const bookConfig = readJson(path.join(repoRoot, 'book-config.json'), issues, 'book-config.json');
  if (!bookConfig) return;
  if (!bookConfig.ux || !bookConfig.ux.modules || bookConfig.ux.modules.figureIndex !== true) {
    issues.push('book-config.json ux.modules.figureIndex must be true');
  }
  const appendices = (bookConfig.structure && bookConfig.structure.appendices) || [];
  const routeMatches = appendices.filter((item) => item.path === FIGURE_INDEX_ROUTE);
  if (routeMatches.length !== 1) issues.push(`book-config figure-index route: expected once, got ${routeMatches.length}`);
  if (routeMatches[0] && (routeMatches[0].id !== 'figure-index' || routeMatches[0].title !== '図表索引')) {
    issues.push('book-config figure-index entry must use id "figure-index" and title "図表索引"');
  }
  const appendixBIndex = appendices.findIndex((item) => item.id === 'appendix02');
  const figureIndex = appendices.findIndex((item) => item.id === 'figure-index');
  if (appendixBIndex < 0 || figureIndex !== appendixBIndex + 1) issues.push('book-config figure index must immediately follow Appendix B');

  const navigationText = readText(path.join(repoRoot, 'docs/_data/navigation.yml'), issues, 'docs/_data/navigation.yml');
  const navAppendices = parseNavigationItems(navigationText, 'appendices');
  const navMatches = navAppendices.filter((item) => item.path === FIGURE_INDEX_ROUTE);
  if (navMatches.length !== 1 || navMatches[0].title !== '図表索引') issues.push('navigation appendices must contain one 図表索引 route');
  const navAppendixBIndex = navAppendices.findIndex((item) => item.path === '/appendices/appendix02/');
  const navFigureIndex = navAppendices.findIndex((item) => item.path === FIGURE_INDEX_ROUTE);
  if (navAppendixBIndex < 0 || navFigureIndex !== navAppendixBIndex + 1) issues.push('navigation figure index must immediately follow Appendix B');

  const topText = readText(path.join(repoRoot, 'docs/index.md'), issues, 'docs/index.md');
  if (countMatches(topText, /site\.data\.navigation\.appendices/g) !== 1) issues.push('docs/index.md must render navigation.appendices exactly once');

  const appendixBPaths = ['src/appendices/appendix02/index.md', 'docs/appendices/appendix02/index.md'];
  for (const relativePath of appendixBPaths) {
    const text = readText(path.join(repoRoot, relativePath), issues, relativePath);
    if (countMatches(text, /\[図表索引\]\(\.\.\/figure-index\/\)/g) !== 1) issues.push(`${relativePath} must link next to the figure index exactly once`);
  }

  const docsIndexText = readText(path.join(repoRoot, 'docs/appendices/figure-index/index.md'), issues, 'docs figure index');
  const docsIndexFrontMatter = parseFrontMatter(docsIndexText);
  if (docsIndexFrontMatter.layout !== 'book' || docsIndexFrontMatter.order !== '17' || docsIndexFrontMatter.title !== '図表索引') {
    issues.push('docs figure index front matter must set layout=book, order=17, and title=図表索引');
  }
  const afterwordText = readText(path.join(repoRoot, 'docs/afterword/index.md'), issues, 'docs/afterword/index.md');
  if (parseFrontMatter(afterwordText).order !== '18') issues.push('docs afterword front matter must set order=18');
  if (countMatches(docsIndexText, /\[あとがき\]\(\.\.\/\.\.\/afterword\/\)/g) !== 1) issues.push('docs figure index must link next to the afterword exactly once');

  const markdownIncludes = walkMarkdown(path.join(repoRoot, 'docs')).flatMap((file) => {
    const text = fs.readFileSync(file, 'utf8');
    return [...text.matchAll(/{%\s*include\s+page-navigation\.html\s*%}/g)].map(() => file);
  });
  if (markdownIncludes.length) issues.push(`page-navigation include must not appear in Markdown pages: ${markdownIncludes.map((file) => path.relative(repoRoot, file)).join(', ')}`);
  const layoutText = readText(path.join(repoRoot, 'docs/_layouts/book.html'), issues, 'docs/_layouts/book.html');
  if (countMatches(layoutText, /{%\s*include\s+page-navigation\.html\s*%}/g) !== 1) issues.push('book layout must include page-navigation.html exactly once');

  const cssText = readText(path.join(repoRoot, 'docs/assets/css/main.css'), issues, 'docs/assets/css/main.css');
  for (const requiredCss of ['.book-figure', 'scroll-margin-top', '.book-figure:target', '*:focus-visible', '@media print', 'page-break-inside']) {
    if (!cssText.includes(requiredCss)) issues.push(`main.css is missing figure accessibility/print rule: ${requiredCss}`);
  }

  if (manifest.length && !docsIndexText.includes('READMEの手順画像')) issues.push('figure index must state that README images are excluded');
}

function validateSourceFigures(repoRoot, manifest, issues) {
  const files = walkMarkdown(path.join(repoRoot, 'src'));
  const records = [];
  let mermaidCount = 0;
  let anchorCount = 0;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    mermaidCount += countMatches(text, /^```mermaid\s*$/gm);
    anchorCount += countMatches(text, /<span\s+id="figure-\d+-\d+"\s+class="figure-anchor"><\/span>/g);
    records.push(...extractSourceFigures(text, path.relative(repoRoot, file).split(path.sep).join('/')));
  }
  if (mermaidCount !== manifest.length) issues.push(`source Mermaid count: expected ${manifest.length}, got ${mermaidCount}`);
  if (anchorCount !== manifest.length) issues.push(`source stable-anchor count: expected ${manifest.length}, got ${anchorCount}`);
  assertExactRecordSet(records, manifest, 'source Mermaid figures', issues);
  for (const figure of manifest) {
    const record = records.find((item) => item.id === figure.id);
    if (!record) continue;
    if (record.number !== figure.number || record.title !== figure.title) issues.push(`source ${figure.id} number/title does not match manifest`);
    if (record.file !== figure.source) issues.push(`source ${figure.id} file: expected ${figure.source}, got ${record.file}`);
  }
  const actualOrder = records
    .sort((a, b) => manifest.findIndex((item) => item.source === a.file) - manifest.findIndex((item) => item.source === b.file) || a.position - b.position)
    .map((item) => item.number);
  if (JSON.stringify(actualOrder) !== JSON.stringify(EXPECTED_FIGURE_NUMBERS)) issues.push(`source figure body order mismatch: ${actualOrder.join(', ')}`);
}

function validatePublicFigures(repoRoot, manifest, issues) {
  // Scan the complete published source tree so an accidental numbered figure
  // outside a chapter cannot evade the exact public inventory gate.
  const files = walkMarkdown(path.join(repoRoot, 'docs'));
  const records = [];
  const numberedImages = [];
  let mermaidCount = 0;
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const relativeFile = path.relative(repoRoot, file).split(path.sep).join('/');
    if (relativeFile.startsWith('docs/chapters/')) {
      mermaidCount += countMatches(text, /^```mermaid\s*$|language-mermaid/gm);
    }
    records.push(...extractPublicFigures(text, relativeFile));
    numberedImages.push(...extractNumberedSvgImages(text, relativeFile));
  }
  if (mermaidCount !== 0) issues.push(`public chapter Mermaid count: expected 0, got ${mermaidCount}`);
  if (numberedImages.length !== manifest.length) issues.push(`public numbered SVG count: expected ${manifest.length}, got ${numberedImages.length}`);
  assertExactRecordSet(records, manifest, 'public SVG figures', issues);
  const duplicateAssets = duplicates(numberedImages.map((item) => item.asset).filter(Boolean));
  if (duplicateAssets.length) issues.push(`public numbered figures have duplicate assets: ${duplicateAssets.join(', ')}`);
  for (const figure of manifest) {
    const record = records.find((item) => item.id === figure.id);
    if (!record) continue;
    if (record.number !== figure.number || record.title !== figure.title) issues.push(`public ${figure.id} number/title does not match manifest`);
    if (record.file !== figure.public) issues.push(`public ${figure.id} file: expected ${figure.public}, got ${record.file}`);
    if (record.asset !== figure.asset) issues.push(`public ${figure.id} asset: expected ${figure.asset}, got ${record.asset}`);
    if (record.alt !== `${figure.number}: ${figure.alt}`) issues.push(`public ${figure.id} alt does not match its meaningful manifest description`);
    const uses = numberedImages.filter((item) => item.asset === figure.asset);
    if (uses.length !== 1) issues.push(`public asset ${figure.asset}: expected one numbered body reference, got ${uses.length}`);

    const assetFile = path.join(repoRoot, 'docs', figure.asset.replace(/^\/+/, ''));
    if (!fs.existsSync(assetFile) || !fs.statSync(assetFile).isFile() || fs.statSync(assetFile).size === 0) {
      issues.push(`public asset is missing or empty: ${figure.asset}`);
      continue;
    }
    const svg = fs.readFileSync(assetFile, 'utf8');
    if (!/<title(?:\s[^>]*)?>[^<]+<\/title>/.test(svg) || !/<desc(?:\s[^>]*)?>[^<]+<\/desc>/.test(svg)) {
      issues.push(`public SVG must contain non-empty title and desc: ${figure.asset}`);
    }
  }
  const actualOrder = records
    .sort((a, b) => manifest.findIndex((item) => item.public === a.file) - manifest.findIndex((item) => item.public === b.file) || a.position - b.position)
    .map((item) => item.number);
  if (JSON.stringify(actualOrder) !== JSON.stringify(EXPECTED_FIGURE_NUMBERS)) issues.push(`public figure body order mismatch: ${actualOrder.join(', ')}`);
}

function validateIndexPages(repoRoot, manifest, issues) {
  const paths = ['src/appendices/figure-index/index.md', 'docs/appendices/figure-index/index.md'];
  const bodies = [];
  for (const relativePath of paths) {
    const text = readText(path.join(repoRoot, relativePath), issues, relativePath);
    const body = stripFrontMatter(text);
    bodies.push(body);
    if (/(^|\n)\s*\|.*\|\s*(\n|$)|<table\b/i.test(body)) issues.push(`${relativePath} must use a mobile-safe non-table presentation`);
    const entries = extractIndexEntries(body);
    if (entries.length !== manifest.length) issues.push(`${relativePath} index count: expected ${manifest.length}, got ${entries.length}`);
    const duplicateNumbers = duplicates(entries.map((item) => item.number));
    if (duplicateNumbers.length) issues.push(`${relativePath} has duplicate index entries: ${duplicateNumbers.join(', ')}`);
    const actualNumbers = entries.map((item) => item.number);
    if (JSON.stringify(actualNumbers) !== JSON.stringify(EXPECTED_FIGURE_NUMBERS)) issues.push(`${relativePath} index body order mismatch: ${actualNumbers.join(', ')}`);
    for (const [index, figure] of manifest.entries()) {
      const entry = entries[index];
      if (!entry) continue;
      const expectedHref = `../../${figure.chapterPath.replace(/^\/+/, '')}#${figure.id}`;
      const expectedChapter = `${figure.chapterLabel}「${figure.chapterTitle}」`;
      for (const [field, expected] of [
        ['number', figure.number], ['title', figure.title], ['href', expectedHref],
        ['chapter', expectedChapter], ['purpose', figure.purpose], ['reviewPoint', figure.reviewPoint],
      ]) {
        if (entry[field] !== expected) issues.push(`${relativePath} entry ${index + 1} ${field}: expected ${expected}, got ${entry[field]}`);
      }
    }
  }
  if (bodies.length === 2 && bodies[0] !== bodies[1]) issues.push('source and docs figure-index bodies must be identical');
}

function validateFigureIndex(repoRoot = path.resolve(__dirname, '..')) {
  const absoluteRoot = path.resolve(repoRoot);
  const issues = [];
  const manifest = validateManifest(readJson(path.join(absoluteRoot, 'figure-index.json'), issues, 'figure-index.json'), issues);
  validateConfiguration(absoluteRoot, manifest, issues);
  validateSourceFigures(absoluteRoot, manifest, issues);
  validatePublicFigures(absoluteRoot, manifest, issues);
  validateIndexPages(absoluteRoot, manifest, issues);
  if (issues.length) throw new FigureIndexValidationError(issues);
  return { figureCount: manifest.length, assetCount: new Set(manifest.map((item) => item.asset)).size };
}

if (require.main === module) {
  try {
    const result = validateFigureIndex(process.argv[2] || path.resolve(__dirname, '..'));
    console.log(`OK: figure index is bidirectionally consistent (${result.figureCount} source Mermaid, public SVG, and index entries)`);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  EXPECTED_FIGURE_NUMBERS,
  FIGURE_INDEX_ROUTE,
  FigureIndexValidationError,
  validateFigureIndex,
};
