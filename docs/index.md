---
layout: book
order: 1
title: "ITインフラストラクチャ技術ガイド"
---

# ITインフラストラクチャ技術ガイド

ベンダー非依存の観点からインフラストラクチャ技術の本質的な設計原理と実装手法を体系化した技術書

## 学習成果

- ネットワーク、OS、仮想化、コンテナ、クラウドなど、ITインフラを構成する主要コンポーネントの役割と関係性を、ベンダー固有の用語に依存せず整理できるようになる。
- 各レイヤーの代表的な技術（L2/L3、トランスポート、OS内部、仮想化、分散ストレージ、高可用性構成など）について、設計原理と代表的な実装パターンを説明できるようになる。
- 新しい製品・サービスに触れるときに「どのレイヤーのどの問題を解決しようとしているのか」を自分でマッピングし、採用是非を検討するための観点を持てるようになる。
- クラウドネイティブなアーキテクチャや自動化技術を含め、将来の変化に耐えうるインフラ構成や技術選択のフレームワークを自分なりに構築できるようになる。

## 読み方ガイド

- まず全体像を掴みたい読者は、「はじめに」と第1〜3章を順番に読み、プロトコルスタックとOS/仮想化の関係を俯瞰してから、第4章以降に進むことを推奨する。
- 既にネットワークやOSの基礎は理解しており、コンテナやクラウド周辺を強化したい読者は、第7〜9章・第12章を中心に読み、必要に応じて前半の章に戻って背景を確認する読み方も有効である。
- 特定のテーマ（仮想化、高可用性、分散ストレージなど）に関心が高い読者は、興味のある章から読み始めても構わないが、その際は第1章のプロトコルスタックの整理を事前に確認しておくと理解しやすい。
- 実務での技術選定やレビューに関与している読者は、第13章「技術選択のフレームワーク」を読みつつ、関連する各章を参照する形で、自分の判断基準を明文化するための材料として活用してほしい。

## 想定読者
（想定読者を記載してください）

## 前提知識
（前提知識を記載してください）

## 所要時間
（所要時間の目安を記載してください）

## 目次

{% for item in site.data.navigation.introduction %}
- [{{ item.title }}]({{ item.path | relative_url }})
{% endfor %}

{% for chapter in site.data.navigation.chapters %}
- [{{ chapter.title }}]({{ chapter.path | relative_url }})
{% endfor %}




## 付録

{% for appendix in site.data.navigation.appendices %}
- [{{ appendix.title }}]({{ appendix.path | relative_url }})
{% endfor %}

{% for afterword in site.data.navigation.afterword %}
- [{{ afterword.title }}]({{ afterword.path | relative_url }})
{% endfor %}


## ライセンス

本書は **Creative Commons BY-NC-SA 4.0** ライセンスで公開されています。  
**🔓 教育・研究・個人学習での利用は自由** ですが、**💼 商用利用には事前許諾** が必要です。

📋 [詳細なライセンス条件](https://github.com/itdojp/it-engineer-knowledge-architecture/blob/main/LICENSE.md)

**お問い合わせ**  
株式会社アイティードゥ（ITDO Inc.）  
Email: [knowledge@itdo.jp](mailto:knowledge@itdo.jp)

---

**著者:** 株式会社アイティードゥ  
**バージョン:** 1.0.0  
**最終更新:** 2025-07-16

{% include page-navigation.html %}
