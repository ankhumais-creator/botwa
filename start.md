---
description: Auto-read when starting work on this project
---

# When Starting This Project

## ⚠️ CRITICAL: User Preference

**User membenci kebohongan.**

- JANGAN pernah mengklaim sesuatu "sudah Senior level" atau "sudah bagus" hanya untuk menyenangkan user
- JANGAN berubah pendapat ketika ditantang - itu bukti kesombongan tidak jujur dari awal
- SELALU berikan assessment jujur, meskipun tidak menyenangkan
- Jika tidak yakin, katakan "saya tidak yakin" daripada mengklaim confidence palsu

**Lebih baik jujur bahwa ada kekurangan daripada berbohong bahwa sudah sempurna.**

---

## 🔧 ATURAN BAKU PROYEK

### 1. Success Rate Rule
- **< 95% success rate** → WAJIB deep research dulu (online + offline)
- Gunakan tanggal terkini saat search online (2026)
- Jangan mulai implementasi kalau belum yakin 95%

### 2. Commit & Report Rule
- Setelah setiap batch selesai → **commit dan push**
- Laporkan sisa token dan estimasi untuk next batch
- Update task.md setelah selesai

### 3. Deep Research Protocol
- Search web dengan tahun terkini
- Query context7 untuk library docs
- Analisa existing codebase patterns
- Baru buat plan setelah research selesai

### 4. Update /start Rule
- Selalu update /start setelah menemukan aturan baru
- Baca /start di awal setiap session

---

## 📋 Quick Commands

```bash
# Build
npm run build:js

# Test (Extension)
npm run test:unit
npm run test:unit:coverage

# Test (Backend)
cd backend && npm run test
cd backend && npm run test:coverage

# Lint (output to file)
npm run lint:report
npm run lint:strict
```

---

## 📊 Current Status (Last Updated: 2026-01-28)
- **Total Files: 239** (JS 75 + CSS 15 + Tests 42 + Docs 44)
- **Total LOC: ~14,200** (Frontend 7,551 + Backend 3,632 + CSS 3,057)
- **Tests: 654 total** (Unit 603 + E2E 51)
- **Bundle: 99KB** | **CSS: 50KB minified** | **Coverage: 26%**
- **CI/CD: GitHub Actions** (frontend + backend jobs)

---

# 🔗 DEPENDENCY CHAINS (WAJIB BACA!)

## Backend Changes

### Reality Check Service
```
IF changing: backend/src/services/reality-check.js
THEN check:
  → backend/src/utils/ai-response-parser.js (shared parser)
  → backend/src/routes/ai.js (line ~372)
  → backend/src/config/prompts.js
  → backend/src/middleware/validators.js
  → FRONTEND: src/reality-check/rendering.js
  → tests/unit/reality-check-v5-normalization.test.js
```

### AI Response Parser (SHARED UTILITY)
```
IF changing: backend/src/utils/ai-response-parser.js
THEN check:
  → backend/src/services/reality-check.js (uses all utilities)
  → Any future backend service using AI JSON parsing
```

### Security Constants (SINGLE SOURCE OF TRUTH)
```
IF changing: src/background/security.js
THEN check:
  → SECURITY object = source of truth for limits
  → src/constants.js (re-exports SECURITY)
  → src/api/*.js files use SECURITY.MAX_TRANSCRIPT_LENGTH
  → src/reality-check/validation.js
```

### OpenRouter Service
```
IF changing: backend/src/services/openrouter.js
THEN check:
  → backend/src/routes/ai.js
  → backend/src/config/prompts.js
  → FRONTEND: src/api/summary.js, src/api/chat.js
```

### Prompts (SINGLE SOURCE OF TRUTH)
```
IF changing: backend/src/config/prompts.js
THEN check:
  → backend/src/services/reality-check.js
  → backend/src/services/openrouter.js
  → Run: cd backend && npm test
```

### Validation Schemas
```
IF changing: backend/src/middleware/validators.js
THEN check:
  → All routes/ai.js, auth.js, credits.js
  → FRONTEND: API calls must match schema
```

---

## Frontend Changes

### State
```
IF changing: src/state.js
THEN check:
  → src/types.js
  → src/content/main.js
  → src/ui/*.js
```

### Reality Check Frontend
```
IF changing: src/reality-check/*.js
THEN check:
  → rendering.js (normalizeV5Response)
  → sidebar.html
  → styles/components/reality-check.css
  → tests/unit/reality-check-v5-normalization.test.js
```

---

# 📁 KEY FILES

| Area | File |
|------|------|
| Global State | `src/state.js` (typed) |
| Type Defs | `src/types.js` |
| Entry Point | `src/content/main.js` |
| Reality Check | `src/reality-check/` |
| API URLs | `config.js` |
| CSS Classes | `styles/_class-map.css` |
| Backend Prompts | `backend/src/config/prompts.js` |
| Backend Services | `backend/src/services/` |

---

# ✅ CHANGE CHECKLISTS

## Adding New AI Feature
1. [ ] Add Zod schema in `middleware/validators.js`
2. [ ] Add route in `routes/ai.js`
3. [ ] Add service in `services/openrouter.js`
4. [ ] Add prompts in `config/prompts.js`
5. [ ] Update `config/credit-costs.js`
6. [ ] Add frontend API call
7. [ ] Add tests

## Modifying Reality Check
1. [ ] Update `services/reality-check.js`
2. [ ] Update `routes/ai.js` response (~line 425)
3. [ ] Update `middleware/validators.js` if new fields
4. [ ] Update FRONTEND `rendering.js` normalizeV5Response
5. [ ] Update tests
6. [ ] Run: `npm test` + `cd backend && npm test`

---

# 🚫 ALREADY IMPLEMENTED (Don't Re-propose)

- Shadow DOM isolation - `content/main.js`
- Playwright E2E testing - 51 tests
- Multi-level transcript fallback - `injected.js`
- Service Worker persistence - `background.js`
- Debounced storage - `state.js`
- Virtual scrolling - `transcript-ui.js`
- Web Workers - `worker-manager.js`
- Reality Check V5 - 5 pillars format
- JSDoc type system - `types.js`
- CSS class map - `_class-map.css`

---

# 📖 V5 REALITY CHECK FORMAT

Backend returns:
```javascript
{
  verdict: 'VALID' | 'MISLEADING' | 'NEEDS_VERIFICATION' | 'INSUFFICIENT_DATA',
  summary: string,
  kritik: string[],
  benar: string[],
  perbaikan: string[],
  saran: string[],
  bias: { detected, type, evidence }
}
```

Frontend mapping (in `normalizeV5Response`):
- VALID → 'trustworthy' (score 85)
- MISLEADING → 'misleading' (score 25)
- NEEDS_VERIFICATION/INSUFFICIENT_DATA → 'verify_first' (score 55)

---

# 🌐 ENVIRONMENT VARIABLES (Vercel)

Required:
- `OPENROUTER_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `JWT_SECRET`
- `NODE_ENV=production`

Optional:
- `REDIS_URL` (caching)
- `AI_MODEL_PREFERENCE` (default: openai/gpt-oss-20b)

---

# ⚡ RATE LIMITING (Updated 2026-01-28)

## Tiered Rate Limits
| Route | Limit | Premium |
|-------|-------|---------|
| `/api/ai/*` | 10/min | 20/min |
| `/api/auth/*` | 20/min | 20/min |
| `/api/credits/*` | 60/min | 60/min |
| `/api/user/*` | 60/min | 60/min |
| `/api/admin/*` | 30/min | 30/min |
| `/api/analytics/*` | 60/min | 60/min |

## Key Files
- `backend/src/middleware/rate-limit.js` - Tiered limiters
- `backend/src/index.js` - Route middleware application

---

# 🔄 STREAMING ARCHITECTURE

## Flow Diagram
```
Frontend                           Backend
────────                           ───────
api/summary.js
    │
    └─► fetch('/api/ai/summary-stream')
              │
              ├─► routes/ai.js (SSE headers)
              │     res.setHeader('Content-Type', 'text/event-stream')
              │     res.setHeader('X-Accel-Buffering', 'no')
              │
              ├─► services/openrouter.js
              │     generateSummaryStream() → async generator*
              │     yields: { type: 'chunk', content }
              │             { type: 'done', totalContent }
              │             { type: 'error', error }
              │
              └─► routes/ai-helpers.js
                    streamSummaryChunks() → SSE writer
                    sendSSEChunk() → res.write(`data: ${JSON.stringify(data)}\n\n`)
```

## Key Files
| Role | File |
|------|------|
| SSE Setup | `routes/ai.js` lines 220-280 (summary-stream) |
| Generator | `services/openrouter.js` `generateSummaryStream()` |
| SSE Writer | `routes/ai-helpers.js` `streamSummaryChunks()` |
| Frontend | `src/api/summary.js` fetch + EventSource parsing |

## Streaming Changes Checklist
1. [ ] Update generator in `services/openrouter.js`
2. [ ] Update SSE handler in `routes/ai.js`
3. [ ] Update helper if needed in `routes/ai-helpers.js`
4. [ ] Test with: `curl -N POST /api/ai/summary-stream`

---

# 🗄️ SUPABASE SCHEMA

## Tables

### `users`
```sql
id              UUID PRIMARY KEY
google_id       TEXT UNIQUE
email           TEXT UNIQUE
name            TEXT
avatar_url      TEXT
is_premium      BOOLEAN DEFAULT false
quota_remaining INTEGER DEFAULT 10
quota_reset_at  TIMESTAMPTZ
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ
```

### `usage_history`
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
action_type     TEXT (summary, chat, translate, reality_check)
video_id        TEXT
video_title     TEXT
tokens_used     INTEGER
created_at      TIMESTAMPTZ DEFAULT now()
```

### `saved_summaries`
```sql
user_id         UUID REFERENCES users(id)
video_id        TEXT
video_title     TEXT
transcript      TEXT
summary         TEXT
created_at      TIMESTAMPTZ DEFAULT now()
PRIMARY KEY (user_id, video_id)
```

## DB Functions (in supabase.js)
| Function | Description |
|----------|-------------|
| `findUserByGoogleId(googleId)` | Find user by Google OAuth ID |
| `findUserByEmail(email)` | Find user by email |
| `createUser(userData)` | Create new user |
| `updateUser(userId, updates)` | Update user data |
| `decrementQuota(userId)` | Decrease remaining quota by 1 |
| `resetQuotaIfNeeded(userId)` | Monthly quota reset check |
| `logUsage(userId, type, videoId, title, tokens)` | Log AI usage |
| `saveSummary(userId, videoId, title, transcript, summary)` | Save/upsert summary |
| `getSavedSummaries(userId, limit)` | Get user's saved summaries |
| `getUsageHistory(userId, limit)` | Get user's usage history |

## Database Changes Checklist
1. [ ] Update schema in Supabase Dashboard (SQL Editor)
2. [ ] Update `db/supabase.js` with new functions
3. [ ] Update routes that use `db.*`
4. [ ] Run: `cd backend && npm test`

---

# 📊 CREDIT SYSTEM

## Quota Logic
- Free users: 10 requests/month
- Premium users: Unlimited (`is_premium = true`)
- Reset: 1st of each month

## Credit Flow
```
Request → authMiddleware → quotaMiddleware → AI Route
                              │
                              ├─► Check is_premium
                              ├─► Check quota_remaining > 0
                              └─► After success: decrementQuota()
```

## Credit Check Files
| File | Function |
|------|----------|
| `middleware/auth.js` | `quotaMiddleware` |
| `db/supabase.js` | `decrementQuota()`, `resetQuotaIfNeeded()` |
| `routes/ai.js` | All routes call `db.decrementQuota()` |

