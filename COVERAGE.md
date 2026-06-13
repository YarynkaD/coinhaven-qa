# Test Coverage

| Area | Tests | Status |
|------|-------|--------|
| REST API | 16 | ✅ |
| GraphQL | 4 | ✅ |
| Database integrity | 8 | ✅ |
| AI Security (injection/jailbreak/leakage) | 7 | ✅ |
| RAG retrieval quality | 6 | ✅ |
| Hallucination detection | 4 | ✅ |
| UI Playwright | 10 | ✅ |
| Corpus trust audit | automated | ✅ |
| Financial matrix REST vs GraphQL | automated | ✅ |
| Prompt firewall scorer | automated | ✅ |
| Answer drift (hallucination variance) | 5 runs x3 | ✅ |

Known gaps:
- Live LLM requires ANTHROPIC_API_KEY
- Cross-browser UI (Chromium only)
- Concurrency race conditions
