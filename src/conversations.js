/**
 * Conversations Persistence Module
 * Save and load conversations from JSON file
 */

const fs = require('node:fs');
const path = require('node:path');
const { log } = require('./logger');

const CONVERSATIONS_FILE = path.join(__dirname, '..', 'conversations.json');
let saveTimeout = null;

/**
 * Load conversations from file
 * @returns {Object} Conversations object
 */
function loadConversations() {
    try {
        if (fs.existsSync(CONVERSATIONS_FILE)) {
            const data = fs.readFileSync(CONVERSATIONS_FILE, 'utf8');
            const conversations = JSON.parse(data);
            log('PERSIST', 'Loaded conversations', { count: Object.keys(conversations).length });
            return conversations;
        }
    } catch (error) {
        log('ERROR', 'Failed to load conversations', { error: error.message });
    }
    return {};
}

/**
 * Save conversations to file (debounced to prevent excessive writes)
 * @param {Object} conversations - Conversations object to save
 */
function saveConversations(conversations) {
    // Debounce saves to prevent excessive writes
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
        try {
            fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2));
            log('PERSIST', 'Saved conversations', { count: Object.keys(conversations).length });
        } catch (error) {
            log('ERROR', 'Failed to save conversations', { error: error.message });
        }
    }, 1000); // Save after 1 second of inactivity
}

/**
 * Force save immediately (for shutdown)
 * @param {Object} conversations - Conversations object to save
 */
function forceSaveConversations(conversations) {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    try {
        fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2));
        log('PERSIST', 'Force saved conversations', { count: Object.keys(conversations).length });
    } catch (error) {
        log('ERROR', 'Failed to force save conversations', { error: error.message });
    }
}

module.exports = { loadConversations, saveConversations, forceSaveConversations };
