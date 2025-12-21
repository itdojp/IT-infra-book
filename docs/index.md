---
layout: book
order: 1
title: "ITインフラストラクチャ技術ガイド"
---

# ITインフラストラクチャ技術ガイド

ベンダー非依存の観点からインフラストラクチャ技術の本質的な設計原理と実装手法を体系化した技術書

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

- [あとがき]({{ '/afterword/' | relative_url }})


## 📄 ライセンス

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
