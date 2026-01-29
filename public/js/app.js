/**
 * WhatsApp Web Clone - Main Application Entry Point
 * All modular imports and initialization
 */

// ============ MODULE IMPORTS ============
import * as DB from './db.js';
import state, { RETRY_CONFIG } from './state.js';
import { els, $ } from './dom.js';
import { renderContacts } from './chat.js';
import { showQR, updateConnectionStatus } from './ui-handlers.js';
import { bindClickEvents, bindKeypressEvents, setupSearchInput, setupMessageSearchInput, exposeGlobalFunctions } from './events.js';

// Import socket-handlers to initialize Socket.IO connection
import './socket-handlers.js';

// ============ GLOBAL ERROR HANDLING ============
globalThis.addEventListener('error', (event) => {
    console.error('🚨 Global error caught:', event.error);
});

globalThis.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled promise rejection:', event.reason);
});

// ============ RETRY UTILITY ============
async function fetchWithRetry(url, options = {}, retries = RETRY_CONFIG.maxRetries) {
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            if (i === retries) throw err;
            const delay = Math.min(
                RETRY_CONFIG.baseDelayMs * Math.pow(2, i),
                RETRY_CONFIG.maxDelayMs
            );
            console.warn(`⚠️ Retry ${i + 1}/${retries} for ${url} in ${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

// ============ HELPER FUNCTIONS ============
function populateSettingsForm(config) {
    if ($('inp-url')) $('inp-url').value = config?.baseUrl || '';
    if ($('inp-key')) $('inp-key').value = config?.apiKey || '';
    if ($('inp-model')) $('inp-model').value = config?.modelName || '';
    if ($('inp-prompt')) $('inp-prompt').value = config?.systemPrompt || '';
}

async function loadCachedConversations() {
    const cachedConvs = await DB.getAllConversations();
    for (const c of cachedConvs) {
        state.conversations[c.jid] = c;
    }
    if (cachedConvs.length > 0) {
        renderContacts();
        console.log('✅ Loaded from cache:', cachedConvs.length, 'conversations');
    }
    return cachedConvs.length;
}

async function syncConversationsFromServer() {
    const convRes = await fetchWithRetry('/api/conversations');
    const convData = await convRes.json();
    for (const conv of convData) {
        state.conversations[conv.jid] = conv;
        await DB.saveConversation(conv.jid, conv);
    }
    return convData.length;
}

function enterOfflineMode() {
    console.error('🚨 All initialization attempts failed. Entering offline mode.');
    if (Object.keys(state.conversations).length > 0) {
        renderContacts();
    }
}

// ============ INITIALIZATION ============
async function init() {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`🚀 Initialization attempt ${attempt}/${maxAttempts}`);

            await DB.initDB();
            console.log('🗄️ Database ready');

            await loadCachedConversations();

            const statusRes = await fetchWithRetry('/api/status');
            const statusData = await statusRes.json();

            state.setPausedChats(new Set(statusData.pausedChats || []));
            populateSettingsForm(statusData.config);

            if (statusData.qr) showQR(statusData.qr);
            updateConnectionStatus(statusData.status);

            const convCount = await syncConversationsFromServer();
            renderContacts();
            console.log('✅ App initialized with', convCount, 'conversations');
            return;

        } catch (err) {
            console.error(`❌ Init attempt ${attempt} failed:`, err);
            if (attempt >= maxAttempts) {
                enterOfflineMode();
                return;
            }
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

// ============ DOM CONTENT LOADED ============
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOMContentLoaded fired. Initializing app...');

    // Initialize app
    await init();

    // Bind all event listeners
    bindClickEvents();
    bindKeypressEvents();
    setupSearchInput();
    setupMessageSearchInput();

    // Expose global functions for inline handlers
    exposeGlobalFunctions();

    // Global click to close menus
    document.addEventListener('click', () => {
        els.contextMenu?.classList.add('hidden');
        document.getElementById('chat-menu')?.classList.add('hidden');
    });

    console.log('✅ All event listeners attached');
});
