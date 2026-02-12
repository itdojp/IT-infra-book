# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Japanese-language technical book project about "ITインフラストラクチャ技術ガイド" (IT Infrastructure Technology Guide). The book covers network and server system design and implementation from a vendor-neutral perspective, systematizing essential design principles and implementation methods for infrastructure technologies.

## Repository Structure

This project uses the **book-formatter** system (migrated from book-publishing-template2):

```text
IT-infra-book/
├── docs/                    # Generated output (GitHub Pages)
├── src/                     # Source content
│   ├── introduction/        # Introduction section
│   ├── chapters/           # 13 chapters (chapter01-13)
│   ├── appendices/         # Appendices A & B
│   └── afterword/          # Afterword
├── book-config.json        # Book configuration (book-formatter format)
├── package.json           # Project dependencies and scripts
└── CLAUDE.md             # This file
```

## Book Framework Migration

**IMPORTANT**: This book has been migrated from Book Publishing Template v2 to **book-formatter**.

- ✅ **Current**: Uses book-formatter system
- ❌ **Deprecated**: book-publishing-template2 (no longer supported)

## Key Commands and Workflows

### Development
```bash
npm start                    # Start Jekyll development server
npm run build               # Build the book for production
npm run preview             # Local preview of built book
npm run deploy              # Deploy to GitHub Pages
```

### Content Management
```bash
npm run lint                # Check markdown formatting
npm run check-links         # Validate internal links
npm test                    # Run all tests (lint + links)
npm run clean               # Clean build artifacts
```

## Content Guidelines

### Book Structure
- **4 Parts, 13 Chapters** covering IT infrastructure technology
- **Part I**: Network Architecture and Implementation (Chapters 1-5)
- **Part II**: Server System Design and Implementation (Chapters 6-9)
- **Part III**: Reliability and Security Implementation (Chapters 10-11)
- **Part IV**: Integrated Architecture (Chapters 12-13)

### Technical Focus
- **Vendor-neutral** approach to infrastructure technology
- Emphasis on **design principles** over implementation details
- **Cross-layer optimization** and system integration
- **Open source** based implementations

### Writing Style
- **Target Audience**: Infrastructure engineers, SREs, DevOps engineers
- **Language**: Japanese (formal technical writing style - です・ます調)
- **Approach**: Practical implementation with theoretical foundation
- **Level**: Intermediate to advanced

### Technical Requirements
- **Format**: Markdown (CommonMark + extensions)
- **Encoding**: UTF-8
- **Line endings**: LF (Unix format)
- **Framework**: book-formatter (Jekyll-based)

## Important Notes

1. **Migration Status**: Successfully migrated from book-publishing-template2 to book-formatter
2. **GitHub Pages**: Deploys from `/docs` folder using Jekyll
3. **Author**: 太田和彦（株式会社アイティードゥ）
4. **Technical Focus**: Vendor neutrality and fundamental principles
5. **Target**: Infrastructure professionals and system architects

## Content Focus Areas

### Core Topics
- Infrastructure design principles
- Network implementation technologies
- Security architecture design
- Server system optimization
- Storage architecture
- Load balancing and scaling
- System operation automation
- High availability design
- Performance management
- Technology selection frameworks

### Practical Applications
- Real-world configuration examples
- Best practices and checklists
- Troubleshooting guides
- Implementation methodologies
- Design decision frameworks

## Quality Standards

- **Vendor Neutrality**: Focus on fundamental principles that transcend specific products
- **Technical Accuracy**: Verify all technical details against industry standards
- **Practical Value**: Every concept includes implementation guidance
- **Systematic Approach**: Logical progression from theory to practice

## Contact Information

**Author**: 太田和彦（株式会社アイティードゥ）  
**Email**: knowledge@itdo.jp  
**GitHub**: [@itdojp](https://github.com/itdojp)  
**Organization**: 株式会社アイティードゥ