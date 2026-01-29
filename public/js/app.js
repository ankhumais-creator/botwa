/**
 * WhatsApp Web Clone - Main Application Entry Point
 * All modular imports and initialization
 */

// ============ MODULE IMPORTS ============
import * as DB from './db.js';
import * as state from './state.js';
import { els, $ } from './dom.js';
import { renderContacts, updateAIToggle } from './chat.js';
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
async function fetchWithRetry(url, options = {}, retries = state.RETRY_CONFIG.maxRetries) {
    for (let i = 0; i <= retries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            if (i === retries) throw err;
            const delay = Math.min(
                state.RETRY_CONFIG.baseDelayMs * Math.pow(2, i),
                state.RETRY_CONFIG.maxDelayMs
            );
            console.warn(`⚠️ Retry ${i + 1}/${retries} for ${url} in ${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

// ============ INITIALIZATION ============
async function init() {
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            console.log(`🚀 Initialization attempt ${attempts + 1}/${maxAttempts}`);

            // Initialize database
            await DB.initDB();
            console.log('🗄️ Database ready');

            // Load cached conversations
            const cachedConvs = await DB.getAllConversations();
            cachedConvs.forEach(c => {
                state.conversations[c.jid] = c;
            });

            if (cachedConvs.length > 0) {
                renderContacts();
                console.log('✅ Loaded from cache:', cachedConvs.length, 'conversations');
            }

            // Fetch status & config
            const statusRes = await fetchWithRetry('/api/status');
            const statusData = await statusRes.json();

            state.setPausedChats(new Set(statusData.pausedChats || []));

            // Populate settings form
            if ($('inp-url')) $('inp-url').value = statusData.config?.baseUrl || '';
            if ($('inp-key')) $('inp-key').value = statusData.config?.apiKey || '';
            if ($('inp-model')) $('inp-model').value = statusData.config?.modelName || '';
            if ($('inp-prompt')) $('inp-prompt').value = statusData.config?.systemPrompt || '';

            // Show QR if needed
            if (statusData.qr) showQR(statusData.qr);

            // Update connection status
            updateConnectionStatus(statusData.status);

            // Sync conversations from server
            const convRes = await fetchWithRetry('/api/conversations');
            const convData = await convRes.json();

            for (const conv of convData) {
                state.conversations[conv.jid] = conv;
                await DB.saveConversation(conv.jid, conv);
            }

            renderContacts();
            console.log('✅ App initialized with', convData.length, 'conversations');
            return;

        } catch (err) {
            attempts++;
            console.error(`❌ Init attempt ${attempts} failed:`, err);

            if (attempts >= maxAttempts) {
                console.error('🚨 All initialization attempts failed. Entering offline mode.');
                if (Object.keys(state.conversations).length > 0) {
                    renderContacts();
                }
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
