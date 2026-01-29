/**
 * Shared Application State
 * Central source of truth for all modules
 */

// ============ STATE ============
export let conversations = {};
export let currentJid = null;
export let pausedChats = new Set();
export let contextMenuJid = null;
export let isSocketConnected = false;

// ============ SEARCH STATE ============
export let searchResults = [];
export let currentSearchIndex = -1;
export let searchQuery = '';

// ============ CONFIG ============
export const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000
};

// ============ STATE MUTATORS ============
// These functions allow other modules to update state

export function setConversations(convs) {
    conversations = convs;
}

export function setCurrentJid(jid) {
    currentJid = jid;
}

export function setPausedChats(chats) {
    pausedChats = chats;
}

export function setContextMenuJid(jid) {
    contextMenuJid = jid;
}

export function setSocketConnected(connected) {
    isSocketConnected = connected;
}

export function setSearchResults(results) {
    searchResults = results;
}

export function setCurrentSearchIndex(index) {
    currentSearchIndex = index;
}

export function setSearchQuery(query) {
    searchQuery = query;
}

export function updateConversation(jid, data) {
    conversations[jid] = data;
}

export function deleteConversation(jid) {
    delete conversations[jid];
}
