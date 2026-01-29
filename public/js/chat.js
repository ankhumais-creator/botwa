/**
 * Chat & Message Logic
 * Handles chat selection, message rendering, and sending
 */

import * as DB from './db.js';
import state from './state.js';
import { els, formatTime, escapeHtml } from './dom.js';

// ============ RENDER CONTACTS ============
export function renderContacts() {
    const searchTerm = els.searchInput?.value?.toLowerCase() || '';
    const sorted = Object.values(state.conversations).sort((a, b) => b.lastMessage - a.lastMessage);

    let filtered = sorted;
    if (searchTerm) {
        filtered = sorted.filter(c =>
            c.name?.toLowerCase().includes(searchTerm) ||
            c.jid?.toLowerCase().includes(searchTerm)
        );
    }

    if (filtered.length === 0) {
        els.contactList.innerHTML = '';
        els.emptyContacts?.classList.remove('hidden');
    } else {
        els.emptyContacts?.classList.add('hidden');
        els.contactList.innerHTML = filtered.map(c => createContactHTML(c)).join('');
    }
}

// ============ CREATE CONTACT HTML ============
export function createContactHTML(contact) {
    const time = formatTime(contact.lastMessage);
    const name = escapeHtml(contact.name || contact.jid.split('@')[0]);
    const preview = escapeHtml(contact.lastMessagePreview || '');
    const isActive = contact.jid === state.currentJid ? 'bg-[#2a3942]' : '';
    const isPaused = state.pausedChats.has(contact.jid);
    const statusIcon = isPaused
        ? '<span class="text-yellow-500 text-xs">⏸️</span>'
        : '<span class="text-green-500 text-xs">🤖</span>';

    return `
        <div class="contact-item flex items-center p-3 hover:bg-[#2a3942] cursor-pointer ${isActive}"
             onclick="selectChat('${contact.jid}')"
             oncontextmenu="showContextMenu(event, '${contact.jid}')">
            <div class="w-12 h-12 rounded-full bg-[#6b7175] flex items-center justify-center text-xl mr-3">
                ${name.charAt(0).toUpperCase()}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center">
                    <span class="font-medium truncate">${name}</span>
                    <span class="text-xs text-[#8696a0]">${time}</span>
                </div>
                <div class="flex items-center gap-1">
                    ${statusIcon}
                    <span class="text-sm text-[#8696a0] truncate">${preview}</span>
                </div>
            </div>
        </div>
    `;
}

// ============ FILTER CONTACTS ============
export function filterContacts() {
    renderContacts();
}

// ============ SELECT CHAT ============
export async function selectChat(jid) {
    state.setCurrentJid(jid);
    const conv = state.conversations[jid];

    // Update UI
    els.welcomeScreen?.classList.add('hidden');
    els.chatContainer?.classList.remove('hidden');

    if (els.chatName) els.chatName.textContent = conv?.name || jid.split('@')[0];
    if (els.chatAvatar) els.chatAvatar.textContent = (conv?.name || jid).charAt(0).toUpperCase();

    // Load messages
    const cached = await DB.getConversation(jid);
    if (cached?.messages?.length) {
        renderMessages(cached.messages);
    } else {
        els.messages.innerHTML = '<div class="text-center text-[#8696a0] py-4">No messages yet</div>';
    }

    // Fetch fresh messages
    try {
        const res = await fetch(`/api/messages/${jid}`);
        const data = await res.json();

        if (data.messages) {
            renderMessages(data.messages);
            // Update cache
            state.conversations[jid] = { ...state.conversations[jid], messages: data.messages };
            await DB.saveConversation(jid, state.conversations[jid]);
        }
    } catch (err) {
        console.error('Failed to fetch messages:', err);
    }

    renderContacts();
    updateAIToggle();
}

// ============ RENDER MESSAGES ============
export function renderMessages(messages) {
    els.messages.innerHTML = messages.map(m => createMessageHTML(m)).join('');
    els.messages.scrollTop = els.messages.scrollHeight;
}

// ============ CREATE MESSAGE HTML ============
export function createMessageHTML(msg) {
    const isMe = msg.fromMe;
    const time = formatTime(msg.timestamp);
    const text = escapeHtml(msg.text || getMessageTypeLabel(msg.type));

    return `
        <div class="msg-row flex ${isMe ? 'justify-end' : 'justify-start'} mb-2"
             oncontextmenu="event.preventDefault(); deleteMessage('${msg.id}')">
            <div class="max-w-[65%] ${isMe ? 'bg-[#005c4b]' : 'bg-[#202c33]'} rounded-lg px-3 py-2">
                <div class="whitespace-pre-wrap break-words">${text}</div>
                <div class="text-xs text-[#8696a0] text-right mt-1">${time}</div>
            </div>
        </div>
    `;
}

// ============ GET MESSAGE TYPE LABEL ============
function getMessageTypeLabel(type) {
    const labels = {
        image: '📷 Image',
        video: '🎥 Video',
        audio: '🎵 Audio',
        document: '📄 Document',
        sticker: '🎭 Sticker'
    };
    return labels[type] || `📎 ${type || 'Media'}`;
}

// ============ SEND MESSAGE ============
export async function sendMessage() {
    const input = els.messageInput;
    const text = input?.value?.trim();

    if (!text || !state.currentJid) return;

    input.value = '';

    try {
        const res = await fetch('/api/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ remoteJid: state.currentJid, text })
        });

        if (!res.ok) throw new Error('Failed to send');

        // Optimistic update
        const newMsg = {
            id: Date.now().toString(),
            text,
            fromMe: true,
            timestamp: Date.now()
        };

        const conv = state.conversations[state.currentJid];
        if (conv) {
            conv.messages = conv.messages || [];
            conv.messages.push(newMsg);
            conv.lastMessage = Date.now();
            conv.lastMessagePreview = text;
            await DB.saveConversation(state.currentJid, conv);
        }

        renderMessages(conv?.messages || [newMsg]);
        renderContacts();

    } catch (err) {
        console.error('Send failed:', err);
        alert('Failed to send message');
    }
}

// ============ DELETE MESSAGE ============
export async function deleteMessage(id) {
    if (!confirm('Delete this message?')) return;

    const conv = state.conversations[state.currentJid];
    if (conv?.messages) {
        conv.messages = conv.messages.filter(m => m.id !== id);
        await DB.saveConversation(state.currentJid, conv);
        renderMessages(conv.messages);
    }
}

// ============ AI TOGGLE ============
export function updateAIToggle() {
    if (!state.currentJid) return;

    const isPaused = state.pausedChats.has(state.currentJid);

    if (els.aiLabel) {
        els.aiLabel.textContent = isPaused ? 'AI Off' : 'AI On';
    }


    if (els.aiToggle) {
        els.aiToggle.classList.toggle('bg-[#00a884]', !isPaused);
        els.aiToggle.classList.toggle('bg-[#3b4a54]', isPaused);
    }

    if (els.aiDot) {
        els.aiDot.classList.toggle('translate-x-5', !isPaused);
        els.aiDot.classList.toggle('translate-x-0', isPaused);
    }
}

export async function toggleAI() {
    if (!state.currentJid) return;

    const isPaused = state.pausedChats.has(state.currentJid);

    try {
        await fetch('/api/toggle-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jid: state.currentJid, pause: !isPaused })
        });

        if (isPaused) {
            state.pausedChats.delete(state.currentJid);
        } else {
            state.pausedChats.add(state.currentJid);
        }

        updateAIToggle();
        renderContacts();

    } catch (err) {
        console.error('Toggle AI failed:', err);
    }
}
