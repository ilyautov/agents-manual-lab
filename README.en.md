# Agent Engineering (in Russian)

A free Russian-language book on building an LLM agent that never refunds twice: state machines, tool contracts, budgets, retries, human in the loop, and honest evaluation. Comes with a reproducible TypeScript laboratory. Second book in the "LLM in practice" series after [LLM Theory and AI Lab Practice](https://github.com/ilyautov/llm-manual-lab).

- [Book PDF (Russian)](../../releases/latest) · [Changelog](CHANGELOG.md) · [Report an error](../../issues/new/choose)
- The book itself is Russian-only for now; this file explains the repository structure for international visitors.

## The laboratory

Node.js 24 runs TypeScript natively; no external packages, no network, all randomness is seeded and deterministic.

```bash
npm test          # unit and book-number tests
npm run numbers   # regenerate build/numbers.json
npm run demo:agent  # end-to-end agent: approval, denial, timeout, outage, budget
npm run build     # print the book PDF (pandoc, poppler-utils, Chrome required)
```

Every number printed in the book is produced by this repository's code and substituted into the chapters at build time; the build fails on a missing key. CI rebuilds the PDF on every commit.

## Series

1. [LLM Theory and AI Lab Practice](https://github.com/ilyautov/llm-manual-lab)
2. Agent Engineering (this repo)
3. [RAG: Search, Context, Answer](https://github.com/ilyautov/rag-manual-lab)

## Licenses

Book text: CC BY-NC 4.0. Laboratory code: MIT. Fonts: SIL OFL 1.1.
