#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const siteRoot = path.resolve(process.argv[2] || path.join(repoRoot, 'docs/_site'));
const manifest = JSON.parse(fs.readFileSync(path.join(repoRoot, 'figure-index.json'), 'utf8'));
const baseurl = '/IT-infra-book';
const errors = [];

function readBuilt(relativePath) {
  const filePath = path.join(siteRoot, relativePath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile() || fs.statSync(filePath).size === 0) {
    errors.push(`missing built file: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([:\w-]+)=(?:"([^"]*)"|'([^']*)')/g)) result[match[1]] = match[2] ?? match[3];
  return result;
}

function article(html) {
  const match = html.match(/<article\s+class="page-content">([\s\S]*?)<\/article>/);
  return match ? match[1] : '';
}

function resolvedLink(tag, pageRoute) {
  const href = attributes(tag).href;
  if (!href) return null;
  try {
    return new URL(href, `https://example.test${baseurl}${pageRoute}`);
  } catch (_) {
    return null;
  }
}

function links(html) {
  return [...html.matchAll(/<a\b[^>]*>/g)].map((match) => match[0]);
}

function builtHtmlFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...builtHtmlFiles(target));
    else if (entry.isFile() && entry.name.endsWith('.html')) result.push(target);
  }
  return result;
}

function assertNav(relativeFile, pageRoute, rel, expectedRoute) {
  const html = readBuilt(relativeFile);
  const matches = links(html).filter((tag) => String(attributes(tag).rel || '').split(/\s+/).includes(rel));
  if (matches.length !== 1) {
    errors.push(`${relativeFile} must have exactly one rel=${rel} link, got ${matches.length}`);
    return;
  }
  const url = resolvedLink(matches[0], pageRoute);
  if (!url || url.pathname !== `${baseurl}${expectedRoute}`) errors.push(`${relativeFile} rel=${rel} must point to ${expectedRoute}`);
}

const indexHtml = readBuilt('appendices/figure-index/index.html');
const indexArticle = article(indexHtml);
const indexLinks = links(indexArticle);
if (!indexArticle) errors.push('built figure index has no page-content article');

const builtNumberedFigures = [];
for (const file of builtHtmlFiles(siteRoot)) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/<img\b[^>]*>/g)) {
    const attrs = attributes(match[0]);
    if (!/^図\d+-\d+:\s+/.test(attrs.alt || '')) continue;
    let asset = null;
    try {
      const url = new URL(attrs.src || '', 'https://example.test');
      asset = url.pathname.startsWith(`${baseurl}/assets/`)
        ? url.pathname.slice(baseurl.length)
        : url.pathname;
    } catch (_) {
      // A malformed numbered figure source is reported as an unexpected asset.
    }
    builtNumberedFigures.push({
      file: path.relative(siteRoot, file).split(path.sep).join('/'),
      asset,
      alt: attrs.alt,
    });
  }
}
if (builtNumberedFigures.length !== manifest.length) {
  errors.push(`built public numbered SVG count: expected ${manifest.length}, got ${builtNumberedFigures.length}`);
}
const expectedBuiltAssets = new Set(manifest.map((figure) => figure.asset));
const unexpectedBuiltFigures = builtNumberedFigures.filter((figure) => !expectedBuiltAssets.has(figure.asset));
if (unexpectedBuiltFigures.length) {
  errors.push(`built public numbered SVG inventory has unexpected entries: ${unexpectedBuiltFigures.map((figure) => `${figure.file}:${figure.asset || '(invalid src)'}`).join(', ')}`);
}
for (const asset of expectedBuiltAssets) {
  const uses = builtNumberedFigures.filter((figure) => figure.asset === asset);
  if (uses.length !== 1) errors.push(`built public asset ${asset}: expected one numbered use, got ${uses.length}`);
}

for (const figure of manifest) {
  const chapterRelative = `${figure.chapterPath.replace(/^\/+/, '')}index.html`;
  const chapterHtml = readBuilt(chapterRelative);
  const idCount = [...chapterHtml.matchAll(new RegExp(`id=["']${figure.id}["']`, 'g'))].length;
  if (idCount !== 1) errors.push(`${chapterRelative} must contain anchor ${figure.id} exactly once, got ${idCount}`);
  const expectedAssetUrl = `${baseurl}${figure.asset}`;
  if (!chapterHtml.includes(`src="${expectedAssetUrl}"`) && !chapterHtml.includes(`src='${expectedAssetUrl}'`)) {
    errors.push(`${chapterRelative} does not reference ${expectedAssetUrl}`);
  }
  readBuilt(figure.asset.replace(/^\/+/, ''));

  const directLinks = indexLinks.filter((tag) => {
    const url = resolvedLink(tag, '/appendices/figure-index/');
    return url && url.pathname === `${baseurl}${figure.chapterPath}` && url.hash === `#${figure.id}`;
  });
  if (directLinks.length !== 1) errors.push(`built figure index must deep-link ${figure.id} exactly once, got ${directLinks.length}`);
}

const topHtml = readBuilt('index.html');
const topFigureLinks = links(article(topHtml)).filter((tag) => {
  const url = resolvedLink(tag, '/');
  return url && url.pathname === `${baseurl}/appendices/figure-index/`;
});
if (topFigureLinks.length !== 1) errors.push(`built top page must link the figure index exactly once, got ${topFigureLinks.length}`);

const sidebarFigureLinks = links(indexHtml).filter((tag) => {
  const attrs = attributes(tag);
  const url = resolvedLink(tag, '/appendices/figure-index/');
  return String(attrs.class || '').split(/\s+/).includes('toc-link') && url && url.pathname === `${baseurl}/appendices/figure-index/`;
});
if (sidebarFigureLinks.length !== 1) errors.push(`built sidebar must link the figure index exactly once, got ${sidebarFigureLinks.length}`);

assertNav('appendices/appendix02/index.html', '/appendices/appendix02/', 'next', '/appendices/figure-index/');
assertNav('appendices/figure-index/index.html', '/appendices/figure-index/', 'prev', '/appendices/appendix02/');
assertNav('appendices/figure-index/index.html', '/appendices/figure-index/', 'next', '/afterword/');
assertNav('afterword/index.html', '/afterword/', 'prev', '/appendices/figure-index/');

for (const relativeFile of ['appendices/appendix02/index.html', 'appendices/figure-index/index.html', 'afterword/index.html']) {
  const html = readBuilt(relativeFile);
  const count = [...html.matchAll(/<nav\s+class="page-navigation"/g)].length;
  if (count !== 1) errors.push(`${relativeFile} must render page-navigation exactly once, got ${count}`);
}
const topNavigationCount = [...topHtml.matchAll(/<nav\s+class="page-navigation"/g)].length;
if (topNavigationCount !== 0) errors.push(`built top page must not render page-navigation, got ${topNavigationCount}`);

if (errors.length) {
  console.error(`ERROR: built figure-index checks failed:\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`OK: built figure index route, ${manifest.length} deep links/assets, and Appendix B -> figure index -> afterword navigation are valid`);
}
