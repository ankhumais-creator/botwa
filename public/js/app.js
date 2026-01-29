/**
 * WhatsApp Web Clone - Main Application Logic
 */

// Import IndexedDB module
import * as DB from './db.js';

// ============ GLOBAL ERROR HANDLING ============
// Prevents uncaught errors from crashing the entire app
window.addEventListener('error', (event) => {
    console.error('🚨 Uncaught error:', event.error?.message || event.message);
    // Log but don't crash - app continues running
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled promise rejection:', event.reason);
    event.preventDefault(); // Prevent browser default handling
});

// Log app start time for debugging
console.log('🚀 App loading at:', new Date().toLocaleTimeString());

// ============ SOCKET.IO WITH RECONNECTION ============
const socket = io({
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5  // Built-in jitter for exponential backoff
});

let isSocketConnected = false;

// Connection established
socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
    isSocketConnected = true;
    updateConnectionIndicator('connected');
});

// Disconnected from server
socket.on('disconnect', (reason) => {
    console.warn('🔌 Socket disconnected:', reason);
    isSocketConnected = false;

    if (socket.active) {
        // Socket.IO will auto-reconnect
        updateConnectionIndicator('reconnecting');
    } else {
        // Manual reconnect needed (server denied or client closed)
        updateConnectionIndicator('disconnected');
    }
});

// Connection error
socket.on('connect_error', (error) => {
    console.error('🔌 Socket connection error:', error.message);
    if (socket.active) {
        updateConnectionIndicator('reconnecting');
    } else {
        updateConnectionIndicator('error');
    }
});

// Successfully reconnected (manager event)
socket.io.on('reconnect', (attempt) => {
    console.log('🔌 Socket reconnected after', attempt, 'attempts');
    updateConnectionIndicator('connected');
    // Refresh data after reconnection
    refreshAfterReconnect();
});

// Reconnection failed after all attempts
socket.io.on('reconnect_failed', () => {
    console.error('🔌 Socket reconnection failed after all attempts');
    updateConnectionIndicator('offline');
});

// Helper function to refresh data after reconnect
async function refreshAfterReconnect() {
    try {
        console.log('🔄 Refreshing data after reconnect...');
        const res = await fetchWithRetry('/api/conversations');
        if (res.ok) {
            const data = await res.json();
            // Update local state with fresh data
            if (data.conversations) {
                data.conversations.forEach(c => {
                    if (!conversations[c.jid]) {
                        conversations[c.jid] = c;
                    }
                });
                renderContacts();
            }
        }
    } catch (err) {
        console.error('❌ Refresh after reconnect failed:', err);
    }
}

// Connection status indicator
function updateConnectionIndicator(status) {
    let indicator = document.getElementById('socket-status-indicator');

    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'socket-status-indicator';
        indicator.className = 'fixed bottom-4 right-4 px-3 py-1 rounded-full text-xs font-medium shadow-lg z-50 flex items-center gap-2';
        document.body.appendChild(indicator);
    }

    const configs = {
        connected: { bg: 'bg-green-500', text: 'Connected', show: false },
        reconnecting: { bg: 'bg-yellow-500', text: 'Reconnecting...', show: true },
        disconnected: { bg: 'bg-red-500', text: 'Disconnected', show: true },
        offline: { bg: 'bg-gray-500', text: 'Offline Mode', show: true },
        error: { bg: 'bg-red-600', text: 'Connection Error', show: true }
    };

    const config = configs[status] || configs.disconnected;
    indicator.className = `fixed bottom-4 right-4 px-3 py-1 rounded-full text-xs font-medium shadow-lg z-50 flex items-center gap-2 text-white ${config.bg}`;
    indicator.innerHTML = `<span class="w-2 h-2 rounded-full bg-white ${status === 'reconnecting' ? 'animate-pulse' : ''}"></span>${config.text}`;
    indicator.style.display = config.show ? 'flex' : 'none';

    // Auto-hide connected status after 2 seconds
    if (status === 'connected') {
        indicator.style.display = 'flex';
        setTimeout(() => {
            if (isSocketConnected) {
                indicator.style.display = 'none';
            }
        }, 2000);
    }
}

// ============ RELIABILITY UTILITIES ============
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000
};

async function fetchWithRetry(url, options = {}, retries = RETRY_CONFIG.maxRetries) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(url, {
                ...options,
                signal: options.signal || controller.signal
            });
            clearTimeout(timeout);

            // Don't retry client errors (4xx), except too many requests (429)
            if (!response.ok) {
                if (response.status === 429 || response.status >= 500) {
                    throw new Error(`Server error: ${response.status}`);
                }
            }

            return response;
        } catch (err) {
            if (attempt === retries) throw err;

            const isTimeout = err.name === 'AbortError';
            const errorType = isTimeout ? 'Timeout' : 'Error';

            const delay = Math.min(
                RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
                RETRY_CONFIG.maxDelayMs
            );

            console.warn(`⚠️ ${errorType} fetching ${url} (Attempt ${attempt + 1}/${retries + 1}). Retrying in ${Math.round(delay)}ms...`, err.message);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

// ============ STATE ============
let conversations = {};
let currentJid = null;
let pausedChats = new Set();
let contextMenuJid = null;

// ============ DOM ELEMENTS ============
const $ = id => document.getElementById(id);

const els = {
    // Sidebar
    contactList: $('contact-list'),
    emptyContacts: $('empty-contacts'),
    searchInput: $('search-input'),

    // Chat Area
    welcomeScreen: $('welcome-screen'),
    chatContainer: $('chat-container'),
    messages: $('messages'),
    messageInput: $('message-input'),

    // Chat Header
    chatName: $('chat-name'),
    chatAvatar: $('chat-avatar'),
    chatStatus: $('chat-status'),

    // New Chat Modal
    newChatModal: $('new-chat-modal'),
    newChatInput: $('new-chat-input'),

    // AI Toggle
    aiLabel: $('ai-label'),
    aiToggle: $('ai-toggle'),
    aiDot: $('ai-dot'),

    // Panels & Overlays
    settingsPanel: $('settings-panel'),
    qrCard: $('qr-card'),
    qrcode: $('qrcode'),
    contextMenu: $('context-menu'),
    offlineOverlay: $('offline-overlay'),

    // Audio
    notificationSound: $('notification-sound')
};

// ============ INITIALIZATION ============
async function init() {
    try {
        // 🗄️ Initialize IndexedDB first
        await DB.initDB();
        console.log('🗄️ Database ready');

        // 📦 Load conversations from IndexedDB (cache)
        const cachedConvs = await DB.getAllConversations();
        cachedConvs.forEach(c => {
            conversations[c.jid] = c;
        });

        // Render cached data immediately (instant load!)
        if (cachedConvs.length > 0) {
            renderContacts();
            console.log('✅ Loaded from cache:', cachedConvs.length, 'conversations');
        }

        // Fetch status & config
        const statusRes = await fetchWithRetry('/api/status');
        const statusData = await statusRes.json();

        pausedChats = new Set(statusData.pausedChats || []);

        // Populate settings form
        $('inp-url').value = statusData.config.baseUrl || '';
        $('inp-key').value = statusData.config.apiKey || '';
        $('inp-model').value = statusData.config.modelName || '';
        $('inp-prompt').value = statusData.config.systemPrompt || '';

        // Show QR if needed
        if (statusData.qr) showQR(statusData.qr);

        // Update connection status indicator
        updateConnectionStatus(statusData.status);

        // 🔄 Fetch fresh conversations from server
        const convRes = await fetchWithRetry('/api/conversations');
        const convData = await convRes.json();

        // Merge and save to IndexedDB
        for (const conv of convData) {
            conversations[conv.jid] = conv;
            await DB.saveConversation(conv.jid, conv);
        }

        renderContacts();
        console.log('✅ App initialized with', convData.length, 'conversations');
    } catch (err) {
        console.error('❌ Init error:', err);
    }
}

// ============ CONTACT LIST ============
function renderContacts() {
    const searchTerm = els.searchInput.value.toLowerCase();
    const sorted = Object.values(conversations).sort((a, b) => b.lastMessage - a.lastMessage);
    const filtered = sorted.filter(c => c.name.toLowerCase().includes(searchTerm));

    if (filtered.length === 0) {
        els.emptyContacts.classList.remove('hidden');
        els.contactList.innerHTML = '';
        els.contactList.appendChild(els.emptyContacts);
        return;
    }

    els.emptyContacts.classList.add('hidden');
    els.contactList.innerHTML = filtered.map(c => createContactHTML(c)).join('');
}

function createContactHTML(contact) {
    const isActive = contact.jid === currentJid ? 'active' : '';
    const pauseBadge = contact.isPaused
        ? '<span class="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">PAUSED</span>'
        : '';

    return `
        <div class="contact-item h-[72px] flex items-center px-4 cursor-pointer ${isActive}"
             onclick="selectChat('${contact.jid}')"
             oncontextmenu="showContextMenu(event, '${contact.jid}'); return false;">
            <div class="w-[49px] h-[49px] rounded-full bg-[#dfe5e7] flex items-center justify-center text-[#54656f] font-medium text-sm flex-shrink-0">
                ${contact.name.substring(0, 2).toUpperCase()}
            </div>
            <div class="ml-3 flex-1 min-w-0 border-b border-[#f0f2f5] h-full flex flex-col justify-center py-3">
                <div class="flex justify-between items-baseline">
                    <span class="text-[17px] text-[#111b21] truncate">${escapeHtml(contact.name)}</span>
                    <span class="text-[12px] text-[#667781] flex-shrink-0 ml-2">${formatTime(contact.lastMessage)}</span>
                </div>
                <div class="flex items-center gap-1 mt-0.5">
                    ${pauseBadge}
                    <span class="text-[14px] text-[#667781] truncate">${escapeHtml(contact.lastText || '')}</span>
                </div>
            </div>
        </div>
    `;
}

function filterContacts() {
    renderContacts();
}

// ============ CHAT SELECTION ============
async function selectChat(jid) {
    currentJid = jid;

    // Show chat container
    els.welcomeScreen.classList.add('hidden');
    els.chatContainer.classList.remove('hidden');

    // Update header
    const contact = conversations[jid] || { name: jid.replace('@s.whatsapp.net', ''), isPaused: false };
    els.chatName.textContent = contact.name;
    els.chatAvatar.textContent = contact.name.substring(0, 2).toUpperCase();

    updateAIToggle();

    // 📦 Try to load messages from IndexedDB cache first (instant load!)
    const cachedConv = await DB.getConversation(jid);
    if (cachedConv && cachedConv.messages && cachedConv.messages.length > 0) {
        renderMessages(cachedConv.messages);
        console.log('📦 Loaded', cachedConv.messages.length, 'messages from cache');
    }

    // 🔄 Then fetch fresh messages from server
    try {
        const res = await fetchWithRetry(`/api/conversation/${encodeURIComponent(jid)}`);
        const data = await res.json();

        // Update conversation with fresh messages
        if (conversations[jid]) {
            conversations[jid].messages = data.messages || [];
            await DB.saveConversation(jid, conversations[jid]);
        }

        renderMessages(data.messages || []);
    } catch (err) {
        console.error('Error fetching messages:', err);
        // If server fetch fails, at least we have cached messages
        if (!cachedConv || !cachedConv.messages) {
            renderMessages([]);
        }
    }

    renderContacts();
    els.messageInput.focus();
}

// ============ MESSAGES ============
function renderMessages(messages) {
    els.messages.innerHTML = messages.map(m => createMessageHTML(m)).join('');
    els.messages.scrollTop = els.messages.scrollHeight;
}

function createMessageHTML(msg) {
    const isOutgoing = msg.fromMe;
    const bgClass = isOutgoing ? 'bg-[#d9fdd3]' : 'bg-white';
    const alignClass = isOutgoing ? 'justify-end' : 'justify-start';
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Badge based on message type
    let badge = '';
    if (msg.type === 'bot') {
        badge = '<span class="text-[10px] text-[#00a884] mr-1">🤖</span>';
    } else if (msg.type === 'manual') {
        badge = '<span class="text-[10px] text-blue-500 mr-1">👤</span>';
    }

    // Optimistic message indicator
    const optimisticClass = msg.isOptimistic ? 'optimistic-msg' : '';

    return `
        <div class="msg-row flex ${alignClass} mb-1 animate-fadeInUp ${optimisticClass}" data-msg-id="${msg.id}">
            <div class="${bgClass} rounded-lg p-2 px-3 shadow-sm max-w-[65%] relative group">
                <div class="text-[14.2px] text-[#111b21] leading-[19px] whitespace-pre-wrap">${escapeHtml(msg.text)}</div>
                <div class="flex items-center justify-end gap-1 mt-1">
                    ${badge}
                    <span class="text-[11px] text-[#667781]">${time}</span>
                </div>
                <button onclick="deleteMessage('${msg.id}')" class="msg-actions absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center text-[#667781] hover:text-red-500 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>
            </div>
        </div>
    `;
}

// ============ SEND MESSAGE ============
async function sendMessage() {
    const text = els.messageInput.value.trim();
    if (!text || !currentJid) return;

    // Clear input immediately for instant feedback
    els.messageInput.value = '';

    // OPTIMISTIC UI UPDATE: Show message instantly
    const optimisticMessage = {
        id: 'temp-' + Date.now(),
        text: text,
        fromMe: true,
        timestamp: Date.now(),
        type: 'manual',
        isOptimistic: true // Flag untuk tracking
    };

    // Tambahkan ke conversation di memory
    if (conversations[currentJid]?.messages) {
        conversations[currentJid].messages.push(optimisticMessage);
    }

    // Render langsung ke UI (instant feedback!)
    const messageHTML = createMessageHTML(optimisticMessage);
    els.messages.insertAdjacentHTML('beforeend', messageHTML);
    els.messages.scrollTop = els.messages.scrollHeight;

    console.log('📤 Message displayed (optimistic)');

    // Kirim ke server di background
    try {
        const response = await fetchWithRetry('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remoteJid: currentJid, text })
        });

        if (!response.ok) {
            throw new Error('Send failed');
        }

        console.log('✅ Message sent to server');
        // Server akan kirim update via socket.io, yang akan replace optimistic message
    } catch (err) {
        console.error('❌ Send error:', err);

        // Tampilkan error indicator pada message
        const tempMsg = els.messages.querySelector(`[data-msg-id="${optimisticMessage.id}"]`);
        if (tempMsg) {
            tempMsg.classList.add('opacity-50');
            tempMsg.innerHTML += '<span class="text-red-500 text-xs ml-2">❌ Failed</span>';
        }
    }
}

function handleKey(e) {
    if (e.key === 'Enter') sendMessage();
}

// ============ AI TOGGLE ============
function updateAIToggle() {
    const isPaused = pausedChats.has(currentJid);

    if (isPaused) {
        els.aiLabel.textContent = '⏸️ AI OFF';
        els.aiLabel.className = 'text-[12px] font-medium text-[#667781]';
        els.aiToggle.className = 'w-8 h-4 bg-[#d1d7db] rounded-full relative transition-colors';
        els.aiDot.className = 'w-3 h-3 bg-white rounded-full absolute top-0.5 left-0.5 transition-all shadow-sm';
        els.chatStatus.textContent = '⚠️ AI Paused';
        els.chatStatus.className = 'text-[13px] text-yellow-600';
    } else {
        els.aiLabel.textContent = '🤖 AI ON';
        els.aiLabel.className = 'text-[12px] font-medium text-[#00a884]';
        els.aiToggle.className = 'w-8 h-4 bg-[#00a884] rounded-full relative transition-colors';
        els.aiDot.className = 'w-3 h-3 bg-white rounded-full absolute top-0.5 right-0.5 transition-all shadow-sm';
        els.chatStatus.textContent = 'online';
        els.chatStatus.className = 'text-[13px] text-[#667781]';
    }
}

async function toggleAI() {
    if (!currentJid) return;

    const action = pausedChats.has(currentJid) ? 'resume' : 'pause';

    try {
        await fetchWithRetry('/api/toggle-bot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remoteJid: currentJid, action })
        });
    } catch (err) {
        console.error('Toggle error:', err);
    }
}

// ============ CONTEXT MENU ============
function showContextMenu(e, jid) {
    e.preventDefault();
    contextMenuJid = jid;
    els.contextMenu.classList.remove('hidden');
    els.contextMenu.style.top = e.pageY + 'px';
    els.contextMenu.style.left = e.pageX + 'px';
}

document.addEventListener('click', () => {
    els.contextMenu.classList.add('hidden');
    // Also hide chat menu
    const chatMenu = document.getElementById('chat-menu');
    if (chatMenu) chatMenu.classList.add('hidden');
});

// ============ CHAT MENU (3 dots in header) ============
function showChatMenu(e) {
    const chatMenu = document.getElementById('chat-menu');
    if (!chatMenu) {
        console.error('❌ chat-menu element not found!');
        return;
    }

    // Position the menu below the button
    const button = e.currentTarget || e.target;
    const rect = button.getBoundingClientRect();

    chatMenu.classList.remove('hidden');
    chatMenu.style.top = (rect.bottom + 5) + 'px';
    chatMenu.style.left = (rect.right - chatMenu.offsetWidth) + 'px';

    console.log('📍 Chat menu shown at:', rect.bottom, rect.right);
}

async function renameContact() {
    const newName = prompt('New name:', conversations[contextMenuJid]?.name || '');
    if (!newName) return;

    try {
        await fetchWithRetry(`/api/contact/${encodeURIComponent(contextMenuJid)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
        });
    } catch (err) {
        console.error('Rename error:', err);
    }
}

async function deleteContact() {
    if (!confirm('Delete this chat?')) return;

    try {
        await fetchWithRetry(`/api/contact/${encodeURIComponent(contextMenuJid)}`, {
            method: 'DELETE'
        });
    } catch (err) {
        console.error('Delete error:', err);
    }
}

async function deleteMessage(id) {
    if (!confirm('Delete?')) return;

    try {
        await fetchWithRetry('/api/message', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jid: currentJid, messageId: id })
        });

        // Refresh messages
        const res = await fetch(`/api/conversation/${encodeURIComponent(currentJid)}`);
        const data = await res.json();
        renderMessages(data.messages || []);
    } catch (err) {
        console.error('Delete message error:', err);
    }
}

// ============ SETTINGS ============
function toggleSettings() {
    els.settingsPanel.classList.toggle('hidden');
}

async function saveSettings() {
    const body = {
        baseUrl: $('inp-url').value,
        apiKey: $('inp-key').value,
        modelName: $('inp-model').value,
        systemPrompt: $('inp-prompt').value
    };

    try {
        await fetchWithRetry('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        toggleSettings();
    } catch (err) {
        console.error('Save settings error:', err);
    }
}

async function shutdown() {
    if (!confirm('Shutdown system?')) return;

    try {
        await fetchWithRetry('/api/shutdown', { method: 'POST' });
        els.offlineOverlay.classList.remove('hidden');
    } catch (err) {
        console.error('Shutdown error:', err);
    }
}

// ============ NEW CHAT MODAL ============
function openNewChat() {
    els.newChatModal.classList.remove('hidden');
    els.newChatInput.value = '';
    els.newChatInput.focus();
}

function closeNewChatModal() {
    els.newChatModal.classList.add('hidden');
}

async function confirmNewChat() {
    const input = els.newChatInput.value.trim();
    if (!input) return;

    let num = input.replace(/\D/g, '');
    if (num.startsWith('0')) num = '62' + num.slice(1);

    const jid = num + '@s.whatsapp.net';

    if (!conversations[jid]) {
        conversations[jid] = {
            jid,
            name: num,
            lastMessage: Date.now(),
            lastText: '',
            isPaused: false
        };

        // 💾 Save to IndexedDB
        await DB.saveConversation(jid, conversations[jid]);
    }

    closeNewChatModal();
    selectChat(jid);
    renderContacts();
}

// ============ QR CODE ============
function showQR(qr) {
    els.qrCard.classList.remove('hidden');
    els.qrcode.innerHTML = '';
    new QRCode(els.qrcode, { text: qr, width: 200, height: 200 });
}

// ============ SOCKET EVENTS ============
socket.on('conversation_update', async data => {
    const { jid, conversation } = data;

    conversations[jid] = {
        jid,
        name: conversation.name,
        lastMessage: conversation.lastMessage,
        lastText: conversation.messages.slice(-1)[0]?.text || '',
        isPaused: conversation.isPaused,
        messages: conversation.messages // Store messages too
    };

    // 💾 Save to IndexedDB
    await DB.saveConversation(jid, conversations[jid]);

    renderContacts();

    if (jid === currentJid) {
        renderMessages(conversation.messages);
    }

    // Play notification sound
    if (jid !== currentJid || !document.hasFocus()) {
        try {
            els.notificationSound.play();
        } catch (e) {
            // Audio play may fail due to autoplay policy
        }
    }
});

socket.on('paused_update', data => {
    if (data.isPaused) {
        pausedChats.add(data.remoteJid);
    } else {
        pausedChats.delete(data.remoteJid);
    }

    if (conversations[data.remoteJid]) {
        conversations[data.remoteJid].isPaused = data.isPaused;
    }

    renderContacts();

    if (data.remoteJid === currentJid) {
        updateAIToggle();
    }
});

socket.on('contact_updated', async data => {
    if (conversations[data.jid]) {
        conversations[data.jid].name = data.name;

        // 💾 Update IndexedDB
        await DB.saveConversation(data.jid, conversations[data.jid]);
    }

    renderContacts();

    if (data.jid === currentJid) {
        els.chatName.textContent = data.name;
        els.chatAvatar.textContent = data.name.substring(0, 2).toUpperCase();
    }
});

socket.on('contact_deleted', async data => {
    delete conversations[data.jid];

    // 🗑️ Delete from IndexedDB
    await DB.deleteConversation(data.jid);

    renderContacts();

    if (data.jid === currentJid) {
        currentJid = null;
        els.welcomeScreen.classList.remove('hidden');
        els.chatContainer.classList.add('hidden');
    }
});

socket.on('qr', qr => {
    if (qr) {
        showQR(qr);
    } else {
        els.qrCard.classList.add('hidden');
    }
});

// Handle connection status updates
socket.on('status', status => {
    console.log('📡 Connection status:', status);
    updateConnectionStatus(status);
});

function updateConnectionStatus(status) {
    // Get or create status indicator - fixed at bottom-left corner
    let indicator = document.getElementById('connection-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'connection-indicator';
        indicator.className = 'fixed bottom-4 left-4 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full shadow-lg z-50';
        document.body.appendChild(indicator);
    }

    if (indicator) {
        switch (status) {
            case 'connected':
                indicator.innerHTML = '<span class="w-2 h-2 bg-green-500 rounded-full"></span><span class="text-green-700 font-medium">Connected</span>';
                indicator.className = 'fixed bottom-4 left-4 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full shadow-lg z-50 bg-green-100 border border-green-200';
                els.qrCard?.classList.add('hidden');
                break;
            case 'waiting_for_scan':
                indicator.innerHTML = '<span class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span><span class="text-yellow-700 font-medium">Scan QR</span>';
                indicator.className = 'fixed bottom-4 left-4 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full shadow-lg z-50 bg-yellow-100 border border-yellow-200';
                break;
            case 'disconnected':
                indicator.innerHTML = '<span class="w-2 h-2 bg-red-500 rounded-full"></span><span class="text-red-700 font-medium">Offline</span>';
                indicator.className = 'fixed bottom-4 left-4 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full shadow-lg z-50 bg-red-100 border border-red-200';
                break;
            default:
                indicator.innerHTML = '<span class="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span><span class="text-gray-600 font-medium">Connecting...</span>';
                indicator.className = 'fixed bottom-4 left-4 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full shadow-lg z-50 bg-gray-100 border border-gray-200';
        }
    }
}

// ============ UTILITIES ============
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();

    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ MESSAGE SEARCH ============
let searchResults = [];
let currentSearchIndex = -1;
let searchQuery = '';

function toggleMessageSearch() {
    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-messages-input');

    if (searchBar.classList.contains('hidden')) {
        // Show search bar
        searchBar.classList.remove('hidden');
        searchInput.focus();
        console.log('🔍 Search opened');
    } else {
        // Hide and clear
        searchBar.classList.add('hidden');
        clearSearchHighlights();
        searchInput.value = '';
        searchQuery = '';
        searchResults = [];
        currentSearchIndex = -1;
        updateSearchCounter();
        console.log('🔍 Search closed');
    }
}

function searchMessages(query) {
    if (!query) {
        clearSearchHighlights();
        searchResults = [];
        currentSearchIndex = -1;
        updateSearchCounter();
        return;
    }

    searchQuery = query.toLowerCase();
    clearSearchHighlights();
    searchResults = [];

    // Get all message elements
    const messageRows = els.messages.querySelectorAll('.msg-row');

    messageRows.forEach((row, index) => {
        const textDiv = row.querySelector('.whitespace-pre-wrap');
        if (!textDiv) return;

        const text = textDiv.textContent;
        const lowerText = text.toLowerCase();

        if (lowerText.includes(searchQuery)) {
            searchResults.push({ row, textDiv, text, index });
        }
    });

    if (searchResults.length > 0) {
        // Highlight all results
        searchResults.forEach((result, i) => {
            highlightText(result.textDiv, result.text, searchQuery);
        });

        // Set first result as active
        currentSearchIndex = 0;
        setActiveSearchResult();
        console.log(`🔍 Found ${searchResults.length} matches for "${query}"`);
    } else {
        console.log(`🔍 No matches for "${query}"`);
    }

    updateSearchCounter();
}

function highlightText(element, text, query) {
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    const highlightedHTML = text.replace(regex, '<mark class="search-highlight">$1</mark>');
    element.innerHTML = highlightedHTML;
}

function setActiveSearchResult() {
    if (currentSearchIndex < 0 || currentSearchIndex >= searchResults.length) return;

    // Remove active class from all
    els.messages.querySelectorAll('.search-highlight').forEach(mark => {
        mark.classList.remove('search-active');
    });

    // Add active class to current result
    const currentResult = searchResults[currentSearchIndex];
    const marks = currentResult.textDiv.querySelectorAll('.search-highlight');
    if (marks.length > 0) {
        marks[0].classList.add('search-active');
        currentResult.row.classList.add('search-result-active');

        // Scroll to result
        currentResult.row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    updateSearchCounter();
}

function navigateSearchResult(direction) {
    if (searchResults.length === 0) return;

    if (direction === 'next') {
        currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
    } else if (direction === 'prev') {
        currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    }

    setActiveSearchResult();
}

function clearSearchHighlights() {
    // Remove all highlights
    const highlights = els.messages.querySelectorAll('.search-highlight, .search-active');
    highlights.forEach(mark => {
        const parent = mark.parentNode;
        parent.textContent = parent.textContent; // Remove HTML tags
    });

    // Restore original text by re-rendering
    if (currentJid && conversations[currentJid]) {
        const conv = conversations[currentJid];
        if (conv.messages && conv.messages.length > 0) {
            // Keep the original messages without re-fetching
            const messageRows = els.messages.querySelectorAll('.msg-row');
            messageRows.forEach((row) => {
                row.classList.remove('search-result-active');
            });
        }
    }
}

function updateSearchCounter() {
    const counter = document.getElementById('search-counter');
    const prevBtn = document.getElementById('btn-search-prev');
    const nextBtn = document.getElementById('btn-search-next');

    if (searchResults.length === 0) {
        counter.textContent = searchQuery ? 'No results' : '';
        prevBtn.disabled = true;
        nextBtn.disabled = true;
    } else {
        counter.textContent = `${currentSearchIndex + 1} of ${searchResults.length}`;
        prevBtn.disabled = false;
        nextBtn.disabled = false;
    }
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============ CHAT MENU FUNCTIONS ============
function exportChat() {
    if (!currentJid || !conversations[currentJid]) {
        console.log('❌ No chat selected to export');
        return;
    }

    const conv = conversations[currentJid];
    const messages = conv.messages || [];

    if (messages.length === 0) {
        alert('No messages to export');
        return;
    }

    // Format messages for export
    let exportText = `Chat Export: ${conv.name}\n`;
    exportText += `Exported: ${new Date().toLocaleString()}\n`;
    exportText += `Total Messages: ${messages.length}\n`;
    exportText += '='.repeat(50) + '\n\n';

    messages.forEach(msg => {
        const time = new Date(msg.timestamp).toLocaleString();
        const sender = msg.fromMe ? 'You' : conv.name;
        const typeLabel = msg.type === 'bot' ? ' 🤖' : (msg.type === 'manual' ? ' 👤' : '');
        exportText += `[${time}] ${sender}${typeLabel}:\n${msg.text}\n\n`;
    });

    // Create and download file
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${conv.name.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log('✅ Chat exported successfully');
}

async function clearChat() {
    if (!currentJid) {
        console.log('❌ No chat selected to clear');
        return;
    }

    if (!confirm('Clear all messages in this chat? This cannot be undone.')) {
        return;
    }

    try {
        // Call API to clear messages
        const res = await fetchWithRetry(`/api/conversation/${encodeURIComponent(currentJid)}/clear`, {
            method: 'DELETE'
        });

        if (!res.ok) {
            throw new Error('Failed to clear chat');
        }

        // Update local state
        if (conversations[currentJid]) {
            conversations[currentJid].messages = [];
            conversations[currentJid].lastText = '';
            await DB.saveConversation(currentJid, conversations[currentJid]);
        }

        // Clear UI
        renderMessages([]);
        renderContacts();

        console.log('✅ Chat cleared successfully');
    } catch (err) {
        console.error('❌ Clear chat error:', err);
        alert('Failed to clear chat. Please try again.');
    }
}

// ============ EXPOSE FUNCTIONS TO WINDOW (for Console Testing) ============
// Expose key functions to window for debugging
window.confirmNewChat = confirmNewChat;
window.openNewChat = openNewChat;
window.closeNewChatModal = closeNewChatModal;
window.toggleSettings = toggleSettings;
window.saveSettings = saveSettings;
window.shutdown = shutdown;
window.toggleAI = toggleAI;
window.sendMessage = sendMessage;
window.handleKey = handleKey;
window.renameContact = renameContact;
window.deleteContact = deleteContact;
window.filterContacts = filterContacts;
// CRITICAL: Required for inline onclick handlers in dynamically rendered HTML
window.selectChat = selectChat;
window.showContextMenu = showContextMenu;
window.showChatMenu = showChatMenu;
window.deleteMessage = deleteMessage;

// ============ EVENT LISTENERS (DEFENSIVE PROGRAMMING) ============
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOMContentLoaded fired. Initializing app...');

    // ⚠️ CRITICAL: Initialize app AFTER DOM is ready
    await init();

    // ===== MODAL BUTTONS =====
    const btnStartChat = document.getElementById('btn-start-chat');
    const btnCancelChat = document.getElementById('btn-cancel-chat');
    const newChatInput = document.getElementById('new-chat-input');

    if (btnStartChat) {
        btnStartChat.addEventListener('click', (e) => {
            console.log('🔘 Start Chat clicked via addEventListener');
            e.preventDefault();
            e.stopPropagation();
            confirmNewChat();
        });
        console.log('✅ btn-start-chat listener attached');
    } else {
        console.error('❌ btn-start-chat NOT FOUND!');
    }

    if (btnCancelChat) {
        btnCancelChat.addEventListener('click', (e) => {
            console.log('🔘 Cancel Chat clicked');
            e.preventDefault();
            e.stopPropagation();
            closeNewChatModal();
        });
        console.log('✅ btn-cancel-chat listener attached');
    } else {
        console.error('❌ btn-cancel-chat NOT FOUND!');
    }

    // Enter key for new chat input
    if (newChatInput) {
        newChatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('🔘 Enter pressed in new chat input');
                e.preventDefault();
                confirmNewChat();
            }
        });
        console.log('✅ new-chat-input listener attached');
    }

    // ===== HEADER BUTTONS =====
    const btnNewChat = document.getElementById('btn-new-chat');
    const btnSettingsAvatar = document.getElementById('btn-settings-avatar');
    const btnSettingsMenu = document.getElementById('btn-settings-menu');
    const btnCloseSettings = document.getElementById('btn-close-settings');

    if (btnNewChat) {
        btnNewChat.addEventListener('click', (e) => {
            console.log('🔘 New Chat button clicked');
            e.preventDefault();
            openNewChat();
        });
        console.log('✅ btn-new-chat listener attached');
    }

    if (btnSettingsAvatar) {
        btnSettingsAvatar.addEventListener('click', (e) => {
            console.log('🔘 Settings Avatar clicked');
            e.preventDefault();
            toggleSettings();
        });
        console.log('✅ btn-settings-avatar listener attached');
    }

    if (btnSettingsMenu) {
        btnSettingsMenu.addEventListener('click', (e) => {
            console.log('🔘 Settings Menu clicked');
            e.preventDefault();
            toggleSettings();
        });
        console.log('✅ btn-settings-menu listener attached');
    }

    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', (e) => {
            console.log('🔘 Close Settings clicked');
            e.preventDefault();
            toggleSettings();
        });
        console.log('✅ btn-close-settings listener attached');
    }

    // ===== CHAT CONTROLS =====
    const btnToggleAI = document.getElementById('btn-toggle-ai');
    const btnSendMessage = document.getElementById('btn-send-message');
    const messageInput = document.getElementById('message-input');

    if (btnToggleAI) {
        btnToggleAI.addEventListener('click', (e) => {
            console.log('🔘 AI Toggle clicked');
            e.preventDefault();
            toggleAI();
        });
        console.log('✅ btn-toggle-ai listener attached');
    }

    // Chat header menu button (3 dots)
    const btnChatMenu = document.getElementById('btn-chat-menu');
    if (btnChatMenu) {
        btnChatMenu.addEventListener('click', (e) => {
            console.log('🔘 Chat Menu clicked');
            e.preventDefault();
            e.stopPropagation();
            showChatMenu(e);
        });
        console.log('✅ btn-chat-menu listener attached');
    }

    // Chat menu items
    const btnMenuToggleAI = document.getElementById('btn-menu-toggle-ai');
    const btnMenuExportChat = document.getElementById('btn-menu-export-chat');
    const btnMenuClearChat = document.getElementById('btn-menu-clear-chat');

    if (btnMenuToggleAI) {
        btnMenuToggleAI.addEventListener('click', () => {
            console.log('🔘 Menu: Toggle AI clicked');
            toggleAI();
            document.getElementById('chat-menu')?.classList.add('hidden');
        });
        console.log('✅ btn-menu-toggle-ai listener attached');
    }

    if (btnMenuExportChat) {
        btnMenuExportChat.addEventListener('click', () => {
            console.log('🔘 Menu: Export Chat clicked');
            exportChat();
            document.getElementById('chat-menu')?.classList.add('hidden');
        });
        console.log('✅ btn-menu-export-chat listener attached');
    }

    if (btnMenuClearChat) {
        btnMenuClearChat.addEventListener('click', () => {
            console.log('🔘 Menu: Clear Chat clicked');
            clearChat();
            document.getElementById('chat-menu')?.classList.add('hidden');
        });
        console.log('✅ btn-menu-clear-chat listener attached');
    }

    if (btnSendMessage) {
        btnSendMessage.addEventListener('click', (e) => {
            console.log('🔘 Send Message clicked');
            e.preventDefault();
            sendMessage();
        });
        console.log('✅ btn-send-message listener attached');
    }

    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                console.log('🔘 Enter pressed in message input');
                sendMessage();
            }
        });
        console.log('✅ message-input listener attached');
    }

    // ===== SETTINGS PANEL =====
    const btnSaveSettings = document.getElementById('btn-save-settings');
    const btnShutdown = document.getElementById('btn-shutdown');

    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', (e) => {
            console.log('🔘 Save Settings clicked');
            e.preventDefault();
            saveSettings();
        });
        console.log('✅ btn-save-settings listener attached');
    }

    if (btnShutdown) {
        btnShutdown.addEventListener('click', (e) => {
            console.log('🔘 Shutdown clicked');
            e.preventDefault();
            shutdown();
        });
        console.log('✅ btn-shutdown listener attached');
    }

    // ===== CONTEXT MENU =====
    const btnRenameContact = document.getElementById('btn-rename-contact');
    const btnDeleteContact = document.getElementById('btn-delete-contact');

    if (btnRenameContact) {
        btnRenameContact.addEventListener('click', (e) => {
            console.log('🔘 Rename Contact clicked');
            e.preventDefault();
            renameContact();
        });
        console.log('✅ btn-rename-contact listener attached');
    }

    if (btnDeleteContact) {
        btnDeleteContact.addEventListener('click', (e) => {
            console.log('🔘 Delete Contact clicked');
            e.preventDefault();
            deleteContact();
        });
        console.log('✅ btn-delete-contact listener attached');
    }

    // ===== SEARCH INPUT =====
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        // AGGRESSIVE: Clear autofill garbage immediately on load
        if (searchInput.value.includes('http') ||
            searchInput.value.includes('openrouter') ||
            searchInput.value.includes('api') ||
            searchInput.value.includes('.') && searchInput.value.length > 20) {
            console.log('⚠️ Clearing autofill garbage from search:', searchInput.value);
            searchInput.value = '';
            renderContacts(); // Re-render to show all contacts
        }

        // Input event for filtering
        searchInput.addEventListener('input', () => {
            filterContacts();
        });

        // Focus event to clear autofill garbage
        searchInput.addEventListener('focus', () => {
            if (searchInput.value.includes('http') ||
                searchInput.value.includes('openrouter') ||
                searchInput.value.includes('api')) {
                console.log('⚠️ Clearing autofill on focus');
                searchInput.value = '';
                renderContacts();
            }
        });

        // Blur event - double check after user leaves field
        searchInput.addEventListener('blur', () => {
            if (searchInput.value.includes('http') ||
                searchInput.value.includes('openrouter') ||
                searchInput.value.includes('api')) {
                console.log('⚠️ Clearing autofill on blur');
                searchInput.value = '';
                renderContacts();
            }
        });

        console.log('✅ search-input listeners attached');
    }

    // ===== MESSAGE SEARCH =====
    const btnSearchMessages = document.getElementById('btn-search-messages');
    const searchMessagesInput = document.getElementById('search-messages-input');
    const btnSearchPrev = document.getElementById('btn-search-prev');
    const btnSearchNext = document.getElementById('btn-search-next');
    const btnCloseSearch = document.getElementById('btn-close-search');

    if (btnSearchMessages) {
        btnSearchMessages.addEventListener('click', (e) => {
            console.log('🔘 Search messages clicked');
            e.preventDefault();
            toggleMessageSearch();
        });
        console.log('✅ btn-search-messages listener attached');
    }

    if (searchMessagesInput) {
        searchMessagesInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            searchMessages(query);
        });

        // Escape key to close search
        searchMessagesInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                toggleMessageSearch();
            }
        });

        console.log('✅ search-messages-input listeners attached');
    }

    if (btnSearchPrev) {
        btnSearchPrev.addEventListener('click', (e) => {
            console.log('🔘 Previous search result');
            e.preventDefault();
            navigateSearchResult('prev');
        });
        console.log('✅ btn-search-prev listener attached');
    }

    if (btnSearchNext) {
        btnSearchNext.addEventListener('click', (e) => {
            console.log('🔘 Next search result');
            e.preventDefault();
            navigateSearchResult('next');
        });
        console.log('✅ btn-search-next listener attached');
    }

    if (btnCloseSearch) {
        btnCloseSearch.addEventListener('click', (e) => {
            console.log('🔘 Close search');
            e.preventDefault();
            toggleMessageSearch();
        });
        console.log('✅ btn-close-search listener attached');
    }

    console.log('✅✅✅ ALL EVENT LISTENERS ATTACHED SUCCESSFULLY!');
});
