# SubstrateOS AI Shell Assistant

> Production-grade AI assistant for the browser-based Linux environment

## Problem Statement

**Problem:** Users learning Linux in SubstrateOS need contextual help, command explanations, and guided tutorials without leaving the terminal. Current solutions require switching to external documentation or search engines, breaking the learning flow.

**Target Users:**
- Beginners learning Linux command line
- Developers testing commands in a safe sandbox
- Educators teaching shell concepts
- AI agents needing command execution guidance

**Non-Goals:**
- Replace comprehensive Linux documentation
- Execute arbitrary code outside the sandbox
- Provide system administration for real Linux systems

## Success Metrics

### User-Facing Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Task completion rate | ≥ 85% | User completes suggested command successfully |
| User satisfaction | ≥ 4.2/5 | Post-interaction rating |
| Time to answer | < 3s | P95 response latency |
| Help request resolution | ≥ 90% | User doesn't re-ask same question |

### Quality Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Command accuracy | ≥ 95% | Commands execute without syntax errors |
| Explanation relevance | ≥ 90% | LLM-as-judge score |
| RAG retrieval precision | ≥ 80% | Top-3 chunks contain answer |
| Hallucination rate | < 5% | Claims not grounded in docs |

### System Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| API latency P50 | < 500ms | Time to first token |
| API latency P99 | < 2000ms | Total response time |
| Uptime | ≥ 99.5% | Health check success rate |
| Cost per query | < $0.01 | Token cost + infra |
| Error rate | < 1% | 5xx responses / total |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SubstrateOS Browser                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Terminal  │  │  AI Button  │  │   Command Palette   │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      AI Assistant API                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │  /chat   │  │  /rag    │  │  /agent  │  │  /metrics   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────────────┘  │
│       │             │             │                          │
│  ┌────▼─────────────▼─────────────▼────┐                    │
│  │           Prompt Registry           │                    │
│  │      (versioned, evaluated)         │                    │
│  └─────────────────┬───────────────────┘                    │
│                    │                                         │
│  ┌─────────────────▼───────────────────┐                    │
│  │         RAG Pipeline                 │                    │
│  │  Chunking → Embed → Retrieve → Rank │                    │
│  └─────────────────┬───────────────────┘                    │
│                    │                                         │
│  ┌─────────────────▼───────────────────┐                    │
│  │         LLM Router                   │                    │
│  │  (model selection by task type)      │                    │
│  └─────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Setup
make setup

# Run locally
make run

# Run tests
make test

# Ingest documentation
make ingest

# Run evaluation
make eval
```

## Environment Variables

See `.env.example` for all configuration options.

## License

MIT - Edwards Tech Innovation
