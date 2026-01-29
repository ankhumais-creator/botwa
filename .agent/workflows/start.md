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
# Start Server
npm start

# Test (Playwright E2E)
npx playwright test

# Test with UI
npx playwright test --ui

# Single test file
npx playwright test tests/dashboard.spec.js

# Lint
npx eslint .
```

---

## 📊 Current Status (Last Updated: 2026-01-29)

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express + Socket.IO |
| WhatsApp | Baileys (@whiskeysockets/baileys v7) |
| AI | OpenRouter API (OpenAI SDK) |
| Frontend | Vanilla JS + TailwindCSS (CDN) |
| State | Getter-based object pattern (no mutable exports) |
| Persistence | IndexedDB (frontend) + JSON file (backend) |
| Tests | Playwright E2E |
| Port | 3000 |

---

# 🏗️ PROJECT ARCHITECTURE

```
efficient-wa-bot/
├── index.js              # Main server entry point
├── config.json           # Persisted settings (API key, model, prompt, pausedChats)
├── .env                  # Environment variables (API_KEY, BASE_URL)
│
├── src/                  # Backend modules
│   ├── ai.js             # OpenRouter AI client (generateResponse)
│   ├── config.js         # Config load/save/init
│   ├── conversations.js  # Conversation persistence (JSON file)
│   ├── logger.js         # Structured logging utility
│   ├── routes.js         # All API endpoints
│   ├── whatsapp.js       # Baileys connection & message handling
│   └── middleware/
│       └── rate-limit.js # Express rate limiter
│
├── public/               # Frontend
│   ├── index.html        # Dashboard UI
│   ├── css/style.css     # Custom styles
│   └── js/               # 9 ES6 modules
│       ├── app.js        # Entry point, global handlers, init
│       ├── state.js      # Shared state (getter object pattern)
│       ├── dom.js        # DOM utilities & element getters
│       ├── db.js         # IndexedDB persistence
│       ├── chat.js       # Chat & message rendering
│       ├── search.js     # In-chat message search with highlighting
│       ├── socket-handlers.js  # Socket.IO event handlers
│       ├── ui-handlers.js      # Settings, modals, context menu
│       └── events.js     # Event binding & keyboard shortcuts
│
├── tests/                # Playwright E2E tests
│   ├── dashboard.spec.js
│   └── persistence.spec.js
│
└── auth_info_baileys/    # WhatsApp session (gitignored)
```

---

# 🔌 API ENDPOINTS (src/routes.js)

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `/api/status` | GET | - | Get connection status, QR, config, pausedChats |
| `/api/conversations` | GET | - | Get all conversation summaries |
| `/api/conversation/:jid` | GET | - | Get single conversation with messages |
| `/api/contact/:jid` | PUT | `{ name }` | Update contact name |
| `/api/contact/:jid` | DELETE | - | Delete contact |
| `/api/message` | DELETE | `{ jid, messageId }` | Delete a message |
| `/api/settings` | POST | `{ apiKey, baseUrl, modelName, systemPrompt }` | Update settings |
| `/api/send` | POST | `{ remoteJid, text }` | Send WhatsApp message |
| `/api/toggle-bot` | POST | `{ remoteJid, action: 'pause'/'resume' }` | Toggle AI for chat |
| `/api/health` | GET | - | Health check (in index.js) |
| `/api/debug/conversations` | GET | - | Debug conversation data |
| `/api/debug/simulate-message` | POST | `{ jid, text }` | Simulate incoming message |

---

# 📡 SOCKET.IO EVENTS

## Server → Client
| Event | Data | Description |
|-------|------|-------------|
| `qr` | `qr` string or null | QR code for WhatsApp login |
| `status` | status string | Connection status |
| `conversation_update` | `{ jid, conversation }` | Conversation updated |
| `new_message` | `{ jid, message }` | New message received |
| `msg_log` | `{ direction, remoteJid, text }` | Message log |
| `contact_updated` | `{ jid, name }` | Contact renamed |
| `contact_deleted` | `{ jid }` | Contact deleted |
| `paused_update` | `{ remoteJid, isPaused }` | AI toggle status |
| `ai_error` | `{ jid, error }` | AI generation failed |

---

# 📁 KEY MODULES

## Backend (src/)

| File | Exports | Purpose |
|------|---------|---------|
| `ai.js` | `generateResponse(messages, config)` | OpenRouter API call with error handling |
| `config.js` | `loadConfig()`, `saveConfig()`, `initConfig()` | JSON file persistence |
| `conversations.js` | `loadConversations()`, `saveConversations()`, `forceSaveConversations()` | Conversation persistence with debounce |
| `logger.js` | `log(category, message, data)` | Structured console logging |
| `routes.js` | `setupRoutes(app, getState, io)` | All Express API routes |
| `whatsapp.js` | `connectToWhatsApp(getState, setState, io)` | Baileys connection, message handling |

## Frontend (public/js/)

| File | Key Exports | Purpose |
|------|-------------|---------|
| `state.js` | `default state`, `RETRY_CONFIG` | Getter-based shared state object |
| `dom.js` | `els`, `$()`, `formatTime()`, `escapeHtml()` | DOM utilities |
| `db.js` | `initDB()`, `saveConversation()`, `getAllConversations()` | IndexedDB wrapper |
| `chat.js` | `renderContacts()`, `renderMessages()`, `selectChat()`, `sendMessage()` | Chat UI logic |
| `search.js` | `toggleMessageSearch()`, `searchMessages()`, `navigateSearchResult()` | Message search |
| `socket-handlers.js` | `socket`, `updateConnectionIndicator()` | Socket.IO handlers |
| `ui-handlers.js` | `toggleSettings()`, `showContextMenu()`, `showQR()` | UI interactions |
| `events.js` | `bindClickEvents()`, `exposeGlobalFunctions()` | Event binding |
| `app.js` | - | Entry point, initialization |

---

# 🔗 DEPENDENCY CHAINS

## Backend State Flow
```
index.js (main)
  ├── state object: { sock, currentConfig, qrCodeData, status, pausedChats, conversations }
  ├── getState() → returns state
  ├── setState(updates) → merges updates into state
  │
  ├── src/routes.js → uses getState() for all API handlers
  ├── src/whatsapp.js → uses getState/setState for connection & messages
  └── src/conversations.js → loads/saves conversations to JSON
```

## Frontend State Flow
```
public/js/state.js
  └── Single const object with getters (no mutable exports)
  └── state.conversations, state.currentJid, etc. via getters
  └── state.setConversations(), state.setCurrentJid() for mutations
  
All modules: import state from './state.js'
```

---

# ⚠️ KNOWN GOTCHAS

1. **API Parameter Names**: 
   - `/api/send` expects `{ remoteJid, text }` NOT `{ jid, message }`
   - `/api/toggle-bot` expects `{ remoteJid, action }` NOT `{ jid, pause }`

2. **Frontend State Pattern**:
   - Uses getter-based object: `state.conversations` (getter), `state.setConversations()` (setter)
   - Import as: `import state from './state.js'` (default export)
   - RETRY_CONFIG is named export: `import state, { RETRY_CONFIG } from './state.js'`

3. **Conversation Persistence**:
   - Backend: `src/conversations.js` saves to `conversations.json` with 5s debounce
   - Frontend: `public/js/db.js` saves to IndexedDB
   - Both should stay in sync via Socket.IO events

4. **WhatsApp Session**:
   - Stored in `auth_info_baileys/` (gitignored)
   - Delete folder to force re-login via QR

---

# ✅ CHANGE CHECKLISTS

## Adding New API Endpoint
1. [ ] Add route in `src/routes.js`
2. [ ] Use `getState()` to access shared state
3. [ ] Emit Socket.IO event if real-time update needed
4. [ ] Update frontend to call new endpoint
5. [ ] Add test in `tests/`

## Modifying Chat UI
1. [ ] Update HTML in `public/index.html`
2. [ ] Update render functions in `chat.js`
3. [ ] Update DOM references in `dom.js` if new elements
4. [ ] Test with `npx playwright test`

## Changing AI Behavior
1. [ ] Update `systemPrompt` via Dashboard Settings
2. [ ] Or modify `src/ai.js` for logic changes
3. [ ] Check error handling in `generateResponse()`

## Modifying State
1. [ ] Add getter in `state.js` object
2. [ ] Add setter method in `state.js` object
3. [ ] Update all modules that need the new state

---

# 🚫 ALREADY IMPLEMENTED

- ✅ Socket.IO real-time updates
- ✅ IndexedDB local persistence (db.js)
- ✅ JSON file backend persistence (conversations.js)
- ✅ QR code display for WhatsApp login
- ✅ AI toggle per chat (pause/resume)
- ✅ Context menu for chat operations
- ✅ Settings panel (API key, model, prompt)
- ✅ Message search with highlighting
- ✅ Modular JS architecture (9 frontend + 6 backend modules)
- ✅ Connection status indicator with auto-hide
- ✅ Global error handlers (error, unhandledrejection)
- ✅ Retry utility with exponential backoff
- ✅ Rate limiting middleware

---

# 🌐 ENVIRONMENT VARIABLES (.env)

```env
API_KEY=your-openrouter-api-key
BASE_URL=https://openrouter.ai/api/v1
```

# ⚙️ CONFIGURATION (config.json)

```json
{
  "apiKey": "sk-or-v1-...",
  "baseUrl": "https://openrouter.ai/api/v1",
  "modelName": "google/gemma-3n-e4b-it:free",
  "systemPrompt": "You are a helpful assistant...",
  "pausedChats": ["jid@s.whatsapp.net"]
}
```

---

# 🐛 DEBUG MODE

Health check endpoint: `GET /api/health`

Debug endpoints (dev only):
- `GET /api/debug/conversations` - List all conversations
- `POST /api/debug/simulate-message` - Simulate incoming message

Backend logging uses `src/logger.js`:
```javascript
log('CATEGORY', 'Message', { data });
// Categories: INIT, SOCKET, WA, AI, MSG, API, PAUSE, ERROR
```
