# SubstrateOS AI Assistant - Architecture

## Overview

The AI Assistant is a production-grade service that provides intelligent help for SubstrateOS users. It combines:

1. **LLM-powered chat** with streaming responses
2. **RAG pipeline** for documentation retrieval
3. **Agent capabilities** for tool-assisted tasks
4. **Comprehensive monitoring** for production reliability

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ Browser/Web  │  │  CLI Tools   │  │  AI Agents   │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
└─────────┼─────────────────┼─────────────────┼───────────────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │    Auth     │  │ Rate Limit  │  │   Logging   │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   /v1/chat      │ │   /v1/rag       │ │   /v1/agent     │
│   Chat API      │ │   RAG API       │ │   Agent API     │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       CORE SERVICES                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  Prompt Registry │  │    LLM Client    │  │   RAG Retriever  │   │
│  │  (versioned)     │  │  (multi-provider)│  │   (FAISS/PG)     │   │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   OpenAI API    │ │  Vector Store   │ │    PostgreSQL   │
│   Anthropic API │ │  (FAISS/pgvec)  │ │    (optional)   │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Component Details

### API Layer (`/apps/api`)

**Endpoints:**
- `GET /healthz` - Liveness probe
- `GET /readyz` - Readiness probe
- `POST /v1/chat` - Chat completion (streaming)
- `POST /v1/rag/query` - RAG retrieval
- `POST /v1/agent/run` - Agent execution
- `GET /metrics` - Prometheus metrics

**Middleware Stack:**
1. Logging (trace IDs, structured JSON)
2. Rate Limiting (token bucket)
3. Authentication (API keys)
4. Metrics (request count, latency)

### Prompt System (`/prompts`)

Prompts are:
- **Never hard-coded** in application logic
- **Version-controlled** with metadata
- **Evaluated** against test sets
- **Hot-reloadable** without restart

### RAG Pipeline (`/rag`)

**Ingestion:**
1. Load documents (MD, TXT, code files)
2. Chunk using semantic boundaries
3. Generate embeddings (OpenAI/local)
4. Store in FAISS index

**Retrieval:**
1. Embed query
2. Vector similarity search
3. Optional keyword boost
4. Rerank top results

### Agent System (`/agent`)

ReAct-style agent with:
- Tool use (shell, files, search)
- Safety guardrails
- Iteration limits
- Timeout handling

## Data Flow

### Chat Request

```
1. Request received
   └── Auth check
   └── Rate limit check
   └── Log with trace ID

2. Load prompt
   └── Get from registry
   └── Use specified version

3. RAG augmentation (if enabled)
   └── Embed query
   └── Retrieve relevant chunks
   └── Add to context

4. LLM generation
   └── Stream tokens
   └── Track usage

5. Response
   └── Log completion
   └── Update metrics
```

### Agent Request

```
1. Parse task
2. For each iteration:
   a. LLM generates thought + action
   b. Execute tool (sandboxed)
   c. Observe result
   d. Check for final answer
3. Return steps + answer
```

## Monitoring

### Metrics (Prometheus)
- `api_requests_total` - Request count by endpoint/status
- `api_request_latency_seconds` - Latency histogram
- `llm_tokens_total` - Token usage
- `rag_retrieval_latency_seconds` - RAG performance

### Logging (Structured JSON)
- Trace IDs for request correlation
- PII redaction for compliance
- Error context for debugging

## Deployment

### Docker Compose (Development)
```bash
docker-compose up -d
```

### Production Considerations
- Use managed Postgres with pgvector
- Put API behind load balancer
- Configure proper CORS
- Use secrets manager for API keys
- Set up alerting on error rate
