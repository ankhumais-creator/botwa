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
- **Backend**: Node.js + Express + Socket.IO
- **WhatsApp**: Baileys (WhiskeySockets)
- **AI**: OpenRouter API (DeepSeek/Gemma models)
- **Frontend**: Vanilla JS + TailwindCSS
- **Tests**: Playwright E2E (2 spec files)
- **Port**: 3000

---

# 🏗️ PROJECT ARCHITECTURE

```
efficient-wa-bot/
├── index.js              # Main server (Express + Baileys + Socket.IO)
├── config.json           # Persisted settings (API key, model, prompt)
├── public/
│   ├── index.html        # Dashboard UI
│   ├── css/style.css     # Custom styles
│   └── js/
│       ├── app.js        # Entry point, global handlers
│       ├── state.js      # Shared application state
│       ├── dom.js        # DOM utilities & element getters
│       ├── db.js         # IndexedDB persistence
│       ├── chat.js       # Chat & message rendering
│       ├── search.js     # In-chat message search
│       ├── socket-handlers.js  # Socket.IO event handlers
│       ├── ui-handlers.js      # UI event handlers (modals, context menu)
│       └── events.js     # Event binding & keyboard shortcuts
├── tests/
│   ├── dashboard.spec.js   # Dashboard functionality tests
│   └── persistence.spec.js # Settings persistence tests
└── auth_info_baileys/    # WhatsApp session data (gitignored)
```

---

# 🔗 DEPENDENCY CHAINS

## Backend Changes

### Main Server (index.js)
```
IF changing: index.js
THEN check:
  → API endpoints (/api/*)
  → Socket.IO events (io.emit)
  → WhatsApp connection logic (makeWASocket)
  → AI response handler (getAIClient)
  → FRONTEND: socket-handlers.js
```

### Config Persistence
```
IF changing: loadConfig() or saveConfig()
THEN check:
  → config.json structure
  → FRONTEND: Settings panel submission
  → All places reading currentConfig
```

---

## Frontend Changes

### Modular JS Structure
```
IF changing: public/js/state.js
THEN check:
  → All modules import * as state
  → Setter functions (setConversations, setCurrentJid, etc)
  → Socket handlers updating state

IF changing: public/js/dom.js
THEN check:
  → Element IDs must match index.html
  → Other modules importing { els, $, formatTime, escapeHtml }

IF changing: public/js/chat.js
THEN check:
  → renderContacts(), renderMessages()
  → selectChat() flow
  → Message sending flow
  → AI toggle state

IF changing: public/js/socket-handlers.js
THEN check:
  → Backend Socket.IO emissions
  → State updates
  → Chat/UI refresh calls
```

---

# 📁 KEY FILES

| Area | File |
|------|------|
| Main Server | `index.js` |
| Config Storage | `config.json` |
| Dashboard HTML | `public/index.html` |
| App Entry | `public/js/app.js` |
| Shared State | `public/js/state.js` |
| DOM Utils | `public/js/dom.js` |
| IndexedDB | `public/js/db.js` |
| Chat Logic | `public/js/chat.js` |
| Search | `public/js/search.js` |
| Socket Events | `public/js/socket-handlers.js` |
| UI Handlers | `public/js/ui-handlers.js` |
| Event Bindings | `public/js/events.js` |

---

# ✅ CHANGE CHECKLISTS

## Adding New API Endpoint
1. [ ] Add route in `index.js`
2. [ ] Add Socket.IO emission if real-time needed
3. [ ] Update frontend to call new endpoint
4. [ ] Add test in `tests/`

## Modifying Chat UI
1. [ ] Update HTML in `public/index.html`
2. [ ] Update CSS if needed
3. [ ] Update `chat.js` render functions
4. [ ] Test with `npx playwright test`

## Changing AI Behavior
1. [ ] Update `systemPrompt` in `config.json`
2. [ ] Or update `getAIClient()` in `index.js`
3. [ ] Test with real WhatsApp messages

---

# 🚫 ALREADY IMPLEMENTED (Don't Re-propose)

- Socket.IO real-time updates
- IndexedDB local persistence (db.js)
- QR code display for WhatsApp login
- AI toggle per chat (pause/resume)
- Context menu for chat operations
- Settings panel (API key, model, prompt)
- Message search with highlighting
- Modular JS architecture (9 modules)
- Connection status indicator
- Global error handlers

---

# 🌐 ENVIRONMENT VARIABLES

In `.env`:
```
API_KEY=your-openrouter-api-key
BASE_URL=https://openrouter.ai/api/v1
```

Or configure via Dashboard Settings panel.

---

# ⚙️ CONFIGURATION (config.json)

```javascript
{
  "apiKey": "sk-or-v1-...",           // OpenRouter API key
  "baseUrl": "https://openrouter.ai/api/v1",
  "modelName": "google/gemma-3n-e4b-it", // AI model
  "systemPrompt": "...",              // Bot personality
  "pausedChats": ["jid@s.whatsapp.net"] // Paused AI chats
}
```

---

# 📡 SOCKET.IO EVENTS

## Server → Client
| Event | Data | Description |
|-------|------|-------------|
| `qr` | `{ qr, message }` | QR code for login |
| `status` | `{ status, config }` | Connection status |
| `new_message` | `{ contact }` | New contact/message |
| `msg_log` | `{ direction, remoteJid, text }` | Message log |
| `contact_deleted` | `{ jid }` | Contact deleted |
| `ai_paused` / `ai_resumed` | `{ jid }` | AI toggle |

## Client → Server (via API)
| Endpoint | Method | Body |
|----------|--------|------|
| `/api/status` | GET | - |
| `/api/conversations` | GET | - |
| `/api/messages/:jid` | GET | - |
| `/api/send` | POST | `{ jid, message }` |
| `/api/config` | POST | `{ apiKey, baseUrl, model, prompt }` |
| `/api/toggle-ai` | POST | `{ jid, pause }` |
| `/api/contact` | DELETE | `{ jid }` |

---

# 🐛 DEBUG MODE

Set in `index.js`:
```javascript
const DEBUG = true; // Enable verbose logging
```

Categories: `INIT`, `SOCKET`, `WA`, `AI`, `MSG`, `API`, `PAUSE`, `RESUME`

---

# 📝 FRONTEND MODULE PATTERN

All frontend JS uses ES6 modules:
```javascript
// state.js - Shared state with setters
export let conversations = {};
export function setConversations(convs) { conversations = convs; }

// Other modules import state
import * as state from './state.js';
state.setConversations({...});
```

Global functions for inline onclick handlers are exposed via `window`:
```javascript
// In app.js
window.selectChat = Chat.selectChat;
window.showContextMenu = UI.showContextMenu;
```
