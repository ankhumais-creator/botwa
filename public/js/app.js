/**
 * WhatsApp Web Clone - Main Application Logic
 */

const socket = io();

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
        // Fetch status & config
        const statusRes = await fetch('/api/status');
        const statusData = await statusRes.json();

        pausedChats = new Set(statusData.pausedChats || []);

        // Populate settings form
        $('inp-url').value = statusData.config.baseUrl || '';
        $('inp-key').value = statusData.config.apiKey || '';
        $('inp-model').value = statusData.config.modelName || '';
        $('inp-prompt').value = statusData.config.systemPrompt || '';

        // Show QR if needed
        if (statusData.qr) showQR(statusData.qr);

        // Fetch existing conversations
        const convRes = await fetch('/api/conversations');
        const convData = await convRes.json();
        convData.forEach(c => conversations[c.jid] = c);

        renderContacts();
        console.log('✅ App initialized');
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

    // Fetch and render messages
    try {
        const res = await fetch(`/api/conversation/${encodeURIComponent(jid)}`);
        const data = await res.json();
        renderMessages(data.messages || []);
    } catch (err) {
        console.error('Error fetching messages:', err);
        renderMessages([]);
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
        const response = await fetch('/api/send', {
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
        await fetch('/api/toggle-bot', {
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
});

async function renameContact() {
    const newName = prompt('New name:', conversations[contextMenuJid]?.name || '');
    if (!newName) return;

    try {
        await fetch(`/api/contact/${encodeURIComponent(contextMenuJid)}`, {
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
        await fetch(`/api/contact/${encodeURIComponent(contextMenuJid)}`, {
            method: 'DELETE'
        });
    } catch (err) {
        console.error('Delete error:', err);
    }
}

async function deleteMessage(id) {
    if (!confirm('Delete?')) return;

    try {
        await fetch('/api/message', {
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
        await fetch('/api/settings', {
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
        await fetch('/api/shutdown', { method: 'POST' });
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

function confirmNewChat() {
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
socket.on('conversation_update', data => {
    const { jid, conversation } = data;

    conversations[jid] = {
        jid,
        name: conversation.name,
        lastMessage: conversation.lastMessage,
        lastText: conversation.messages.slice(-1)[0]?.text || '',
        isPaused: conversation.isPaused
    };

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

socket.on('contact_updated', data => {
    if (conversations[data.jid]) {
        conversations[data.jid].name = data.name;
    }

    renderContacts();

    if (data.jid === currentJid) {
        els.chatName.textContent = data.name;
        els.chatAvatar.textContent = data.name.substring(0, 2).toUpperCase();
    }
});

socket.on('contact_deleted', data => {
    delete conversations[data.jid];
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

// ============ START ============
init();

// ============ EVENT LISTENERS (DEFENSIVE PROGRAMMING) ============
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOMContentLoaded fired. Attaching event listeners...');

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

    console.log('✅✅✅ ALL EVENT LISTENERS ATTACHED SUCCESSFULLY!');
});
