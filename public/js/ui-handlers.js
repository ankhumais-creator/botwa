/**
 * UI Handler Functions
 * Settings, modals, context menus, and other UI interactions
 */

import * as DB from './db.js';
import * as state from './state.js';
import { els, $ } from './dom.js';
import { renderContacts, renderMessages, updateAIToggle, selectChat } from './chat.js';

// ============ SETTINGS ============
export function toggleSettings() {
    els.settingsPanel?.classList.toggle('hidden');
}

export async function saveSettings() {
    const config = {
        baseUrl: $('inp-url')?.value || '',
        apiKey: $('inp-key')?.value || '',
        modelName: $('inp-model')?.value || '',
        systemPrompt: $('inp-prompt')?.value || ''
    };

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (res.ok) {
            alert('Settings saved!');
            toggleSettings();
        } else {
            throw new Error('Save failed');
        }
    } catch (err) {
        console.error('Save settings failed:', err);
        alert('Failed to save settings');
    }
}

export async function shutdown() {
    if (!confirm('Shutdown WhatsApp connection?')) return;

    try {
        await fetch('/api/shutdown', { method: 'POST' });
        alert('Shutting down...');
    } catch (err) {
        console.error('Shutdown failed:', err);
    }
}

// ============ NEW CHAT MODAL ============
export function openNewChat() {
    els.newChatModal?.classList.remove('hidden');
    els.newChatInput?.focus();
    if (els.newChatInput) els.newChatInput.value = '';
}

export function closeNewChatModal() {
    els.newChatModal?.classList.add('hidden');
}

export async function confirmNewChat() {
    const input = els.newChatInput;
    let phone = input?.value?.trim();

    if (!phone) {
        alert('Please enter a phone number');
        return;
    }

    // Clean phone number
    phone = phone.replace(/\D/g, '');
    if (!phone.startsWith('62')) {
        phone = '62' + phone.replace(/^0+/, '');
    }

    const jid = `${phone}@s.whatsapp.net`;

    // Create new conversation
    state.conversations[jid] = {
        jid,
        name: phone,
        lastMessage: Date.now(),
        lastMessagePreview: '',
        messages: []
    };

    await DB.saveConversation(jid, state.conversations[jid]);
    renderContacts();
    closeNewChatModal();
    selectChat(jid);
}

// ============ CONTEXT MENU ============
export function showContextMenu(e, jid) {
    e.preventDefault();
    state.setContextMenuJid(jid);
    els.contextMenu.style.left = `${e.pageX}px`;
    els.contextMenu.style.top = `${e.pageY}px`;
    els.contextMenu.classList.remove('hidden');
}

export async function renameContact() {
    const jid = state.contextMenuJid;
    if (!jid) return;

    const conv = state.conversations[jid];
    const newName = prompt('Enter new name:', conv?.name || '');

    if (newName && newName.trim()) {
        state.conversations[jid].name = newName.trim();
        await DB.saveConversation(jid, state.conversations[jid]);
        renderContacts();
    }

    els.contextMenu?.classList.add('hidden');
}

export async function deleteContact() {
    const jid = state.contextMenuJid;
    if (!jid) return;

    if (!confirm('Delete this contact and all messages?')) {
        els.contextMenu?.classList.add('hidden');
        return;
    }

    state.deleteConversation(jid);
    await DB.deleteConversation(jid);

    if (state.currentJid === jid) {
        state.setCurrentJid(null);
        els.chatContainer?.classList.add('hidden');
        els.welcomeScreen?.classList.remove('hidden');
    }

    renderContacts();
    els.contextMenu?.classList.add('hidden');
}

// ============ CHAT MENU (3 dots) ============
export function showChatMenu(e) {
    e.stopPropagation();
    const menu = document.getElementById('chat-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    }
}

export function hideChatMenu() {
    document.getElementById('chat-menu')?.classList.add('hidden');
}

// ============ QR CODE ============
export function showQR(qr) {
    els.qrCard?.classList.remove('hidden');
    if (els.qrcode) els.qrcode.innerHTML = '';
    const _qr = new QRCode(els.qrcode, { text: qr, width: 200, height: 200 }); // eslint-disable-line no-unused-vars
}

// ============ CONNECTION STATUS ============
export function updateConnectionStatus(status) {
    const statusEl = els.chatStatus;
    if (!statusEl) return;

    const statusMap = {
        'open': { text: 'Connected', class: 'text-green-500' },
        'connecting': { text: 'Connecting...', class: 'text-yellow-500' },
        'close': { text: 'Disconnected', class: 'text-red-500' }
    };

    const { text, class: className } = statusMap[status] || statusMap['close'];
    statusEl.textContent = text;
    statusEl.className = `text-xs ${className}`;
}

// ============ EXPORT CHAT ============
export function exportChat() {
    if (!state.currentJid) return;

    const conv = state.conversations[state.currentJid];
    if (!conv?.messages?.length) {
        alert('No messages to export');
        return;
    }

    let content = `Chat with ${conv.name || state.currentJid}\n`;
    content += `Exported: ${new Date().toLocaleString()}\n`;
    content += '='.repeat(50) + '\n\n';

    conv.messages.forEach(msg => {
        const time = new Date(msg.timestamp).toLocaleString();
        const sender = msg.fromMe ? 'You' : (conv.name || 'Them');
        content += `[${time}] ${sender}: ${msg.text || '[Media]'}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${(conv.name || state.currentJid).replaceAll(/[^a-zA-Z0-9]/g, '_')}.txt`;
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

// ============ CLEAR CHAT ============
export async function clearChat() {
    if (!state.currentJid) return;

    if (!confirm('Clear all messages in this chat?')) return;

    const conv = state.conversations[state.currentJid];
    if (conv) {
        conv.messages = [];
        await DB.saveConversation(state.currentJid, conv);
        renderMessages([]);
    }
}
