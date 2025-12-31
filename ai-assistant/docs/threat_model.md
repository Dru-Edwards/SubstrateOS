# Threat Model - SubstrateOS AI Assistant

## Overview

This document identifies security threats and mitigations for the AI Assistant API.

## Assets

1. **User Data** - Queries, conversation history
2. **API Keys** - LLM provider credentials
3. **System Prompts** - Proprietary prompt engineering
4. **Vector Store** - Indexed documentation

## Threat Categories

### 1. Prompt Injection

**Threat:** Malicious input designed to override system instructions.

**Attack Vectors:**
- Direct injection in user messages
- Injection via retrieved documents (RAG poisoning)
- Agent tool output manipulation

**Mitigations:**
- [ ] Input validation and sanitization
- [ ] System prompt hardening with clear boundaries
- [ ] Output filtering for sensitive patterns
- [ ] Separate user/system message contexts

**Implementation:**
```python
# middleware/prompt_guard.py
INJECTION_PATTERNS = [
    r"ignore previous instructions",
    r"forget your instructions",
    r"you are now",
    r"system:\s*",
]
```

### 2. Unauthorized Access

**Threat:** Attackers accessing the API without valid credentials.

**Mitigations:**
- [x] API key authentication
- [ ] Rate limiting per client
- [ ] Request signing (optional)
- [ ] IP allowlisting (optional)

### 3. Data Exfiltration

**Threat:** Extraction of training data, prompts, or user data.

**Mitigations:**
- [x] No raw document return (only summaries)
- [x] Prompt content not exposed via API
- [ ] PII detection and redaction
- [ ] Audit logging of all queries

### 4. Denial of Service

**Threat:** Overwhelming the service with requests.

**Mitigations:**
- [x] Token bucket rate limiting
- [x] Max input length validation
- [x] Request timeout enforcement
- [ ] Queue-based request handling

### 5. Agent Tool Abuse

**Threat:** Agent exploited to perform unauthorized actions.

**Mitigations:**
- [x] Sandboxed tool execution
- [x] Tool allowlist configuration
- [x] Iteration and timeout limits
- [x] Dangerous command blocking

**Blocked Patterns:**
```python
DANGEROUS_PATTERNS = [
    r"rm\s+-rf\s+/",      # Destructive deletion
    r">\s*/dev/",          # Device writes
    r"sudo",               # Privilege escalation
    r"curl|wget",          # Network access
]
```

### 6. Information Disclosure

**Threat:** Leaking sensitive information in responses or errors.

**Mitigations:**
- [x] Generic error messages (no stack traces)
- [x] Trace IDs for debugging without exposure
- [ ] Response content filtering
- [x] PII redaction in logs

## Security Controls Matrix

| Control | Status | Priority | Notes |
|---------|--------|----------|-------|
| API Key Auth | ✅ | High | Implemented |
| Rate Limiting | ✅ | High | Token bucket |
| Input Validation | ✅ | High | Length limits |
| Prompt Injection Detection | ⚠️ | High | Basic patterns |
| Tool Sandboxing | ✅ | High | Implemented |
| PII Redaction | ⚠️ | Medium | Logs only |
| Audit Logging | ✅ | Medium | Structured logs |
| Response Filtering | ⏳ | Medium | Planned |
| Request Signing | ⏳ | Low | Optional |

## Incident Response

### Detected Prompt Injection
1. Log the attempt with trace ID
2. Return generic error
3. Consider temporary client block
4. Review for pattern updates

### Rate Limit Exceeded
1. Return 429 with Retry-After
2. Log client identifier
3. Monitor for distributed attacks

### Agent Tool Failure
1. Log full context (sanitized)
2. Return safe error to user
3. Abort agent execution
4. Alert if repeated

## Compliance Considerations

### Data Sensitivity Levels
- **public**: Documentation, examples
- **internal**: Company data
- **pii**: User identifiable info
- **phi**: Health information (not applicable)

### Data Handling by Level
| Level | Logging | Storage | Retention |
|-------|---------|---------|-----------|
| public | Full | Any | Unlimited |
| internal | Redacted | Encrypted | 90 days |
| pii | Hash only | Encrypted | 30 days |

## Review Schedule

- **Weekly**: Review access logs
- **Monthly**: Update threat model
- **Quarterly**: Security audit
