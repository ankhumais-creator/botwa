/**
 * Socket.IO Event Handlers
 * Handles all real-time communication with server
 */

import * as DB from './db.js';
import * as state from './state.js';
import { els } from './dom.js';
import { renderContacts, renderMessages, updateAIToggle } from './chat.js';
import { showQR, updateConnectionStatus } from './ui-handlers.js';

// ============ SOCKET INITIALIZATION ============
export const socket = io();

// ============ CONNECTION EVENTS ============
socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket.id);
    state.setSocketConnected(true);
    updateConnectionIndicator('connected');
});

socket.on('disconnect', (reason) => {
    console.warn('🔌 Socket disconnected:', reason);
    state.setSocketConnected(false);

    if (socket.active) {
        updateConnectionIndicator('reconnecting');
    } else {
        updateConnectionIndicator('offline');
    }
});

socket.io.on('reconnect', () => {
    console.log('🔌 Socket reconnected!');
    state.setSocketConnected(true);
    updateConnectionIndicator('connected');
    refreshAfterReconnect();
});

socket.io.on('reconnect_failed', () => {
    console.error('🔌 Socket reconnection failed after all attempts');
    updateConnectionIndicator('offline');
});

// ============ DATA EVENTS ============
socket.on('conversation_update', async data => {
    const { jid, conversation } = data;

    console.log('📨 conversation_update received:', {
        jid,
        messageCount: conversation.messages?.length || 0,
        lastMessage: conversation.lastMessage
    });

    state.conversations[jid] = {
        jid,
        name: conversation.name,
        lastMessage: conversation.lastMessage,
        messages: conversation.messages || state.conversations[jid]?.messages || [],
        lastMessagePreview: conversation.messages?.slice(-1)[0]?.text || conversation.lastMessagePreview,
        isPaused: state.pausedChats.has(jid)
    };

    await DB.saveConversation(jid, state.conversations[jid]);
    renderContacts();

    if (jid === state.currentJid) {
        console.log('📱 Rendering messages for current chat:', state.conversations[jid].messages?.length);
        renderMessages(state.conversations[jid].messages);
    }
});

socket.on('new_message', async data => {
    const { jid, message } = data;

    if (!state.conversations[jid]) {
        state.conversations[jid] = {
            jid,
            name: jid.split('@')[0],
            lastMessage: Date.now(),
            messages: []
        };
    }

    state.conversations[jid].messages = state.conversations[jid].messages || [];
    state.conversations[jid].messages.push(message);
    state.conversations[jid].lastMessage = message.timestamp;
    state.conversations[jid].lastMessagePreview = message.text || '[Media]';

    await DB.saveConversation(jid, state.conversations[jid]);
    renderContacts();

    if (jid === state.currentJid) {
        renderMessages(state.conversations[jid].messages);
    }

    // Play notification sound
    if (!message.fromMe && jid !== state.currentJid) {
        try {
            await els.notificationSound?.play();
        } catch (err) {
            console.debug('Notification sound blocked:', err.message);
        }
    }
});

socket.on('ai_status_changed', data => {
    if (data.isPaused) {
        state.pausedChats.add(data.remoteJid);
    } else {
        state.pausedChats.delete(data.remoteJid);
    }

    if (state.conversations[data.remoteJid]) {
        state.conversations[data.remoteJid].isPaused = data.isPaused;
    }

    renderContacts();

    if (data.remoteJid === state.currentJid) {
        updateAIToggle();
    }
});

socket.on('contact_updated', async data => {
    if (state.conversations[data.jid]) {
        state.conversations[data.jid].name = data.name;
        await DB.saveConversation(data.jid, state.conversations[data.jid]);
    }
    renderContacts();
});

socket.on('qr', qr => {
    console.log('📱 QR Code received');
    if (qr) {
        showQR(qr);
    } else {
        els.qrCard?.classList.add('hidden');
    }
});

socket.on('status', status => {
    console.log('📡 Connection status:', status);
    updateConnectionStatus(status);
});

// ============ CONNECTION INDICATOR ============
export function updateConnectionIndicator(status) {
    let indicator = document.getElementById('connection-indicator');

    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'connection-indicator';
        indicator.className = 'fixed top-2 right-2 px-3 py-1 rounded-full text-xs font-medium z-40';
        document.body.appendChild(indicator);
    }

    const statusConfig = {
        'connected': { text: '🟢 Connected', bg: 'bg-green-500/20', color: 'text-green-400' },
        'reconnecting': { text: '🟡 Reconnecting...', bg: 'bg-yellow-500/20', color: 'text-yellow-400' },
        'offline': { text: '🔴 Offline', bg: 'bg-red-500/20', color: 'text-red-400' }
    };

    const config = statusConfig[status] || statusConfig['offline'];
    indicator.textContent = config.text;
    indicator.className = `fixed top-2 right-2 px-3 py-1 rounded-full text-xs font-medium z-40 ${config.bg} ${config.color}`;

    // Auto-hide connected indicator after 3s
    if (status === 'connected') {
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 300);
        }, 3000);
    }
}

// ============ REFRESH AFTER RECONNECT ============
export async function refreshAfterReconnect() {
    console.log('🔄 Refreshing data after reconnect...');

    try {
        const res = await fetch('/api/conversations');
        const convData = await res.json();

        for (const conv of convData) {
            state.conversations[conv.jid] = conv;
            await DB.saveConversation(conv.jid, conv);
        }

        renderContacts();

        if (state.currentJid && state.conversations[state.currentJid]) {
            renderMessages(state.conversations[state.currentJid].messages || []);
        }

        console.log('✅ Data refreshed after reconnect');
    } catch (err) {
        console.error('Failed to refresh after reconnect:', err);
    }
}
