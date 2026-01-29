/**
 * DOM Elements & Utilities
 * Centralized DOM access and helper functions
 */

// ============ DOM ELEMENT GETTER ============
const getEl = (id) => {
    const el = document.getElementById(id);
    if (!el) console.warn(`⚠️ Element #${id} not found`);
    return el;
};

export const $ = getEl;

// ============ LAZY DOM ELEMENT GETTERS ============
export const els = {
    // Sidebar
    get contactList() { return getEl('contact-list'); },
    get emptyContacts() { return getEl('empty-contacts'); },
    get searchInput() { return getEl('search-input'); },

    // Chat Area
    get welcomeScreen() { return getEl('welcome-screen'); },
    get chatContainer() { return getEl('chat-container'); },
    get messages() { return getEl('messages'); },
    get messageInput() { return getEl('message-input'); },

    // Chat Header
    get chatName() { return getEl('chat-name'); },
    get chatAvatar() { return getEl('chat-avatar'); },
    get chatStatus() { return getEl('chat-status'); },

    // New Chat Modal
    get newChatModal() { return getEl('new-chat-modal'); },
    get newChatInput() { return getEl('new-chat-input'); },

    // AI Toggle
    get aiLabel() { return getEl('ai-label'); },
    get aiToggle() { return getEl('ai-toggle'); },
    get aiDot() { return getEl('ai-dot'); },

    // Panels & Overlays
    get settingsPanel() { return getEl('settings-panel'); },
    get qrCard() { return getEl('qr-card'); },
    get qrcode() { return getEl('qrcode'); },
    get contextMenu() { return getEl('context-menu'); },
    get offlineOverlay() { return getEl('offline-overlay'); },

    // Audio
    get notificationSound() { return getEl('notification-sound'); }
};

// ============ UTILITY FUNCTIONS ============

export function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
}

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function escapeRegex(string) {
    return string.replaceAll(String.raw`[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]`, '\\$&');
}
