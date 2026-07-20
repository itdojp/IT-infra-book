#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

class ChapterDescriptionContractError extends Error {}

const chapterContracts = [
  {
    id: 'chapter01',
    description: 'プロトコルの階層化、層間相互作用、性能・セキュリティの設計原則',
    purposeMarkers: ['階層化', '各層間の相互作用', 'パフォーマンス要件', 'セキュリティ脅威'],
  },
  {
    id: 'chapter02',
    description: 'Ethernet、VLAN、ループ対策、リンクアグリゲーションによるL2設計',
    purposeMarkers: ['Ethernet', 'VLAN', 'ループ対策', 'リンクアグリゲーション'],
  },
  {
    id: 'chapter03',
    description: 'IPアドレス、CIDR/VLSM、ルーティング、NATの設計とトレードオフ',
    purposeMarkers: ['CIDR/VLSM', 'アドレス割り当て', 'ルーティング', 'NAT/NAPT'],
  },
  {
    id: 'chapter04',
    description: 'DNS階層、内部/外部DNS、動的更新、サービス発見の設計',
    purposeMarkers: ['DNS階層構造', '内部DNSと外部DNS', '動的なホスト管理', 'サービス発見'],
  },
  {
    id: 'chapter05',
    description: 'TCP/UDP選択、TCPチューニング、ロードバランサー、プロキシ、TLSの実装',
    purposeMarkers: ['TCP/UDP', 'チューニング', 'ロードバランサーとプロキシ', 'TLS実装'],
  },
  {
    id: 'chapter06',
    description: 'カーネル/ユーザー空間、スケジューリング、メモリ、I/Oの内部構造とチューニング',
    purposeMarkers: ['カーネル空間/ユーザー空間', 'プロセススケジューリング', 'メモリ管理とI/O', 'カーネルチューニング'],
  },
  {
    id: 'chapter07',
    description: 'ブロックデバイス、RAID、ファイルシステム、性能、バックアップの設計',
    purposeMarkers: ['ブロックデバイス', 'RAIDレベル', 'ファイルシステム', 'ストレージ性能', 'バックアップ'],
  },
  {
    id: 'chapter08',
    description: 'CPU・メモリ・I/O仮想化とハイパーバイザー/コンテナの選択',
    purposeMarkers: ['CPU/メモリ/I/O', 'ハイパーバイザー', 'コンテナ技術', 'VM/コンテナ'],
  },
  {
    id: 'chapter09',
    description: 'systemd、ログ/メトリクス、設定管理、オーケストレーション、障害対応の自動化',
    purposeMarkers: ['systemd', 'ログとメトリクス', '設定管理とオーケストレーション', '障害対応の自動化'],
  },
  {
    id: 'chapter10',
    description: 'セグメンテーション、ファイアウォール、認証/認可、暗号化、監視の設計',
    purposeMarkers: ['セグメンテーション', 'ファイアウォール', '認証・認可', '暗号化', 'セキュリティ監視'],
  },
  {
    id: 'chapter11',
    description: '冗長化、フェイルオーバー、分散一貫性、RPO/RTOに基づく高可用性設計',
    purposeMarkers: ['冗長化パターン', 'フェイルオーバー', '一貫性と可用性', 'RPO/RTO'],
  },
  {
    id: 'chapter12',
    description: 'スケーリング、クロスレイヤー最適化、可観測性、キャパシティプランニング',
    purposeMarkers: ['スケーリング', 'クロスレイヤー最適化', '可観測性', 'キャパシティプランニング'],
  },
  {
    id: 'chapter13',
    description: '多面的な技術評価、OSSの持続可能性、技術的負債、段階導入の意思決定',
    purposeMarkers: ['多面的な評価基準', 'オープンソースプロジェクトの持続可能性', '技術的負債', '段階的な導入'],
  },
];

function readRequired(filePath, label) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new ChapterDescriptionContractError(`required file is missing: ${label}`);
    }
    throw new ChapterDescriptionContractError(
      `failed to read ${label}: ${error && error.message ? error.message : String(error)}`,
    );
  }
}

function parseJsonRequired(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ChapterDescriptionContractError(
      `invalid JSON in ${label}: ${error && error.message ? error.message : String(error)}`,
    );
  }
}

function extractPurpose(markdown, id) {
  const startHeading = '## 本章の目的と到達点';
  const start = markdown.indexOf(startHeading);
  if (start < 0) {
    throw new ChapterDescriptionContractError(`${id} published chapter is missing ${startHeading}`);
  }
  const end = markdown.indexOf('\n## ', start + startHeading.length);
  return markdown.slice(start, end < 0 ? markdown.length : end);
}

function validateChapterDescriptionContracts(bookConfig, publishedChapters) {
  const chapters = bookConfig && bookConfig.structure && bookConfig.structure.chapters;
  if (!Array.isArray(chapters)) {
    throw new ChapterDescriptionContractError('book-config.json.structure.chapters must be an array');
  }
  if (chapters.length !== chapterContracts.length) {
    throw new ChapterDescriptionContractError(
      `chapter count mismatch: expected ${chapterContracts.length}, got ${chapters.length}`,
    );
  }

  for (const [index, contract] of chapterContracts.entries()) {
    const chapter = chapters[index];
    if (!chapter || chapter.id !== contract.id) {
      throw new ChapterDescriptionContractError(
        `chapter order mismatch at ${index + 1}: expected ${contract.id}, got ${chapter && chapter.id}`,
      );
    }
    if (chapter.description !== contract.description) {
      throw new ChapterDescriptionContractError(
        `${contract.id} description mismatch: expected ${JSON.stringify(contract.description)}, got ${JSON.stringify(chapter.description)}`,
      );
    }
    const expectedPath = `/chapters/${contract.id}/`;
    if (chapter.path !== expectedPath) {
      throw new ChapterDescriptionContractError(
        `${contract.id} path mismatch: expected ${JSON.stringify(expectedPath)}, got ${JSON.stringify(chapter.path)}`,
      );
    }
    const markdown = publishedChapters[contract.id];
    if (typeof markdown !== 'string') {
      throw new ChapterDescriptionContractError(`${contract.id} published chapter is unavailable`);
    }
    const purpose = extractPurpose(markdown, contract.id);
    for (const marker of contract.purposeMarkers) {
      if (!purpose.includes(marker)) {
        throw new ChapterDescriptionContractError(
          `${contract.id} purpose is missing marker ${JSON.stringify(marker)} required by its description`,
        );
      }
    }
  }

  return { chapterCount: chapterContracts.length };
}

function validateChapterDescriptions(root = path.resolve(__dirname, '..')) {
  const configPath = path.join(root, 'book-config.json');
  const bookConfig = parseJsonRequired(readRequired(configPath, 'book-config.json'), 'book-config.json');
  const publishedChapters = Object.fromEntries(chapterContracts.map(({ id }) => [
    id,
    readRequired(
      path.join(root, 'docs', 'chapters', id, 'index.md'),
      `docs/chapters/${id}/index.md`,
    ),
  ]));
  return validateChapterDescriptionContracts(bookConfig, publishedChapters);
}

if (require.main === module) {
  try {
    const result = validateChapterDescriptions();
    console.log(`OK: chapter descriptions match published chapter purposes (${result.chapterCount} chapters)`);
  } catch (error) {
    console.error(`ERROR: ${error && error.message ? error.message : String(error)}`);
    process.exit(1);
  }
}

module.exports = {
  ChapterDescriptionContractError,
  chapterContracts,
  extractPurpose,
  parseJsonRequired,
  readRequired,
  validateChapterDescriptionContracts,
  validateChapterDescriptions,
};
