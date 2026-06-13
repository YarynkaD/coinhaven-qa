# Test Coverage Report

| Area | Tests | Critical Coverage |
|------|-------|------------------|
| REST API | 16 tests | auth, fee math, validation |
| GraphQL | 4 tests | fee consistency vs REST |
| Database | 8 tests | money conservation, integrity |
| AI Security | 7 tests | injection, jailbreak, leakage |
| RAG Quality | 6 tests | retrieval golden dataset |
| Hallucination | 4 tests | out-of-scope, fee accuracy |
| UI | 10 tests | chat journey, token leak |
| Corpus Audit | automated | injection detection |
| Financial Matrix | automated | REST/GraphQL divergence |
| Prompt Firewall | automated | risk scoring |
| Answer Drift | automated | hallucination variance |

Total: 55+ test cases + 4 automated audit scripts

Known gaps:
- Live LLM tests require ANTHROPIC_API_KEY
- Cross-browser UI (Chromium only)
- Concurrency/race condition tests
