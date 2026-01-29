/**
 * Event Listener Setup
 * Declarative event binding configuration
 */

import { renderContacts, filterContacts, selectChat, sendMessage, toggleAI, deleteMessage } from './chat.js';
import {
    toggleSettings, saveSettings, shutdown,
    openNewChat, closeNewChatModal, confirmNewChat,
    showContextMenu, showChatMenu, hideChatMenu,
    renameContact, deleteContact, exportChat, clearChat
} from './ui-handlers.js';
import { toggleMessageSearch, searchMessages, navigateSearchResult } from './search.js';

// ============ CLICK EVENT CONFIG ============
const CLICK_EVENT_CONFIG = [
    // Modal buttons
    { id: 'btn-start-chat', handler: confirmNewChat, preventDefault: true, stopPropagation: true, critical: true },
    { id: 'btn-cancel-chat', handler: closeNewChatModal, preventDefault: true, stopPropagation: true, critical: true },

    // Header buttons
    { id: 'btn-new-chat', handler: openNewChat, preventDefault: true },
    { id: 'btn-settings-avatar', handler: toggleSettings, preventDefault: true },
    { id: 'btn-settings-menu', handler: toggleSettings, preventDefault: true },
    { id: 'btn-close-settings', handler: toggleSettings, preventDefault: true },

    // Chat controls
    { id: 'btn-toggle-ai', handler: toggleAI, preventDefault: true },
    { id: 'btn-chat-menu', handler: showChatMenu, preventDefault: true, stopPropagation: true, passEvent: true },
    { id: 'btn-send-message', handler: sendMessage, preventDefault: true },

    // Menu items (with afterAction to close menu)
    { id: 'btn-menu-toggle-ai', handler: toggleAI, closeMenu: true },
    { id: 'btn-menu-export-chat', handler: exportChat, closeMenu: true },
    { id: 'btn-menu-clear-chat', handler: clearChat, closeMenu: true },

    // Settings panel
    { id: 'btn-save-settings', handler: saveSettings, preventDefault: true },
    { id: 'btn-shutdown', handler: shutdown, preventDefault: true },

    // Context menu
    { id: 'btn-rename-contact', handler: renameContact, preventDefault: true },
    { id: 'btn-delete-contact', handler: deleteContact, preventDefault: true },

    // Search controls
    { id: 'btn-search-messages', handler: toggleMessageSearch, preventDefault: true },
    { id: 'btn-search-prev', handler: () => navigateSearchResult('prev'), preventDefault: true },
    { id: 'btn-search-next', handler: () => navigateSearchResult('next'), preventDefault: true },
    { id: 'btn-close-search', handler: toggleMessageSearch, preventDefault: true }
];

// ============ KEYPRESS EVENT CONFIG ============
const KEYPRESS_EVENT_CONFIG = [
    { id: 'new-chat-input', key: 'Enter', handler: confirmNewChat, preventDefault: true },
    { id: 'message-input', key: 'Enter', handler: sendMessage }
];

// ============ BIND CLICK EVENTS ============
export function bindClickEvents() {
    CLICK_EVENT_CONFIG.forEach(config => {
        const element = document.getElementById(config.id);

        if (!element) {
            if (config.critical) {
                console.error(`❌ ${config.id} NOT FOUND!`);
            }
            return;
        }

        element.addEventListener('click', (e) => {
            console.log(`🔘 ${config.id} clicked`);

            if (config.preventDefault) e.preventDefault();
            if (config.stopPropagation) e.stopPropagation();

            config.passEvent ? config.handler(e) : config.handler();

            if (config.closeMenu) hideChatMenu();
        });

        console.log(`✅ ${config.id} listener attached`);
    });
}

// ============ BIND KEYPRESS EVENTS ============
export function bindKeypressEvents() {
    KEYPRESS_EVENT_CONFIG.forEach(config => {
        const element = document.getElementById(config.id);
        if (!element) return;

        element.addEventListener('keypress', (e) => {
            if (e.key === config.key) {
                console.log(`🔘 ${config.key} pressed in ${config.id}`);
                if (config.preventDefault) e.preventDefault();
                config.handler();
            }
        });

        console.log(`✅ ${config.id} keypress listener attached`);
    });
}

// ============ AUTOFILL GARBAGE CHECK ============
function isAutofillGarbage(value) {
    return value.includes('http') ||
        value.includes('openrouter') ||
        value.includes('api') ||
        (value.includes('.') && value.length > 20);
}

// ============ SETUP SEARCH INPUT ============
export function setupSearchInput() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    // Clear autofill garbage on load
    if (isAutofillGarbage(searchInput.value)) {
        console.log('⚠️ Clearing autofill garbage from search:', searchInput.value);
        searchInput.value = '';
        renderContacts();
    }

    // Input event for filtering
    searchInput.addEventListener('input', filterContacts);

    // Focus/blur events to clear autofill garbage
    ['focus', 'blur'].forEach(eventType => {
        searchInput.addEventListener(eventType, () => {
            if (isAutofillGarbage(searchInput.value)) {
                console.log(`⚠️ Clearing autofill on ${eventType}`);
                searchInput.value = '';
                renderContacts();
            }
        });
    });

    console.log('✅ search-input listeners attached');
}

// ============ SETUP MESSAGE SEARCH INPUT ============
export function setupMessageSearchInput() {
    const searchMessagesInput = document.getElementById('search-messages-input');
    if (!searchMessagesInput) return;

    searchMessagesInput.addEventListener('input', (e) => {
        searchMessages(e.target.value.trim());
    });

    searchMessagesInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') toggleMessageSearch();
    });

    console.log('✅ search-messages-input listeners attached');
}

// ============ EXPOSE FUNCTIONS TO GLOBAL SCOPE ============
// Required for inline onclick handlers in dynamically rendered HTML
export function exposeGlobalFunctions() {
    globalThis.selectChat = selectChat;
    globalThis.showContextMenu = showContextMenu;
    globalThis.showChatMenu = showChatMenu;
    globalThis.deleteMessage = deleteMessage;
    globalThis.confirmNewChat = confirmNewChat;
    globalThis.openNewChat = openNewChat;
    globalThis.closeNewChatModal = closeNewChatModal;
    globalThis.toggleSettings = toggleSettings;
    globalThis.toggleAI = toggleAI;
    globalThis.sendMessage = sendMessage;
    globalThis.renameContact = renameContact;
    globalThis.deleteContact = deleteContact;
    globalThis.filterContacts = filterContacts;

    console.log('✅ Global functions exposed');
}
