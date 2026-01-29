/**
 * Shared Application State
 * Central source of truth for all modules
 * Uses object with getters/setters to avoid mutable export warnings
 */

// ============ INTERNAL STATE ============
const _state = {
    conversations: {},
    currentJid: null,
    pausedChats: new Set(),
    contextMenuJid: null,
    isSocketConnected: false,
    searchResults: [],
    currentSearchIndex: -1,
    searchQuery: ''
};

// ============ CONFIG ============
export const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000
};

// ============ STATE OBJECT ============
// Export a single const object with getters for direct property-style access
// and methods for mutations
const state = {
    // Getters for read access (allows state.conversations, state.currentJid, etc.)
    get conversations() { return _state.conversations; },
    get currentJid() { return _state.currentJid; },
    get pausedChats() { return _state.pausedChats; },
    get contextMenuJid() { return _state.contextMenuJid; },
    get isSocketConnected() { return _state.isSocketConnected; },
    get searchResults() { return _state.searchResults; },
    get currentSearchIndex() { return _state.currentSearchIndex; },
    get searchQuery() { return _state.searchQuery; },

    // Setters
    setConversations(convs) { _state.conversations = convs; },
    setCurrentJid(jid) { _state.currentJid = jid; },
    setPausedChats(chats) { _state.pausedChats = chats; },
    setContextMenuJid(jid) { _state.contextMenuJid = jid; },
    setSocketConnected(connected) { _state.isSocketConnected = connected; },
    setSearchResults(results) { _state.searchResults = results; },
    setCurrentSearchIndex(index) { _state.currentSearchIndex = index; },
    setSearchQuery(query) { _state.searchQuery = query; },

    // Helpers
    updateConversation(jid, data) { _state.conversations[jid] = data; },
    deleteConversation(jid) { delete _state.conversations[jid]; }
};

export default state;
