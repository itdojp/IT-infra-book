# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a book project titled "ITインフラストラクチャ技術ガイド - ネットワークとサーバーシステムの設計と実装" (IT Infrastructure Technology Guide - Network and Server System Design and Implementation). It's a Japanese technical book about IT infrastructure, written in Markdown format using the Book Publishing Template v3.0.

## Repository Structure

```
IT-infra-book/
├── src/
│   ├── introduction/    # はじめに
│   ├── chapters/        # 13章構成
│   ├── appendices/      # 付録A, B
│   └── afterword/       # あとがき
├── docs/               # Generated output (GitHub Pages)
├── book-config.json    # Book configuration
├── index.md           # Book homepage
└── CLAUDE.md          # This file
```

## Writing Guidelines

1. **Language**: All content is written in Japanese
2. **Format**: Markdown (CommonMark + extensions)
3. **Encoding**: UTF-8
4. **Line endings**: LF (Unix format)
5. **Indentation**: 2 spaces

## Book Structure

- **4 Parts, 13 Chapters** covering network and server infrastructure
- **Part I**: Network Architecture and Implementation (Chapters 1-5)
- **Part II**: Server System Design and Implementation (Chapters 6-9)
- **Part III**: Reliability and Security Implementation (Chapters 10-11)
- **Part IV**: Integrated Architecture (Chapters 12-13)

### Technical Focus
- **Vendor-neutral** approach to infrastructure technology
- Emphasis on **design principles** over implementation details
- **Cross-layer optimization** and system integration
- **Open source** based implementations

## Common Commands

```bash
# Install dependencies
npm install

# Build the book
npm run build

# Preview locally
npm run preview

# Clean build artifacts
npm run clean
```

## Content Guidelines

### Technical Accuracy
- Verify all technical details against vendor-neutral principles
- Ensure code examples are working and tested
- Use industry-standard terminology

### Writing Style
- Clear, concise technical Japanese
- Use appropriate technical katakana terms
- Follow Japanese punctuation rules (。、)
- Maintain formal technical writing style (です・ます調)

### Code Examples
- Use syntax highlighting with appropriate language tags
- Keep examples concise and focused
- Include comments in Japanese where helpful
- Test all code examples for accuracy

## Important Notes

1. This book uses the simplified Book Publishing Template v3.0
2. GitHub Pages deployment is from the /docs folder
3. The author is 太田和彦（株式会社アイティードゥ）
4. All content should maintain vendor neutrality
5. Focus on fundamental principles that transcend specific products