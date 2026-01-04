/**
 * IndexedDB Database Module for WhatsApp Clone
 * Handles persistent storage of conversations and messages
 */

const DB_NAME = 'WhatsAppClone';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

let db = null;

/**
 * Initialize IndexedDB
 * @returns {Promise<IDBDatabase>}
 */
export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('❌ IndexedDB error:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('✅ IndexedDB initialized');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create conversations object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'jid' });

                // Create index for sorting by last message timestamp
                store.createIndex('lastMessage', 'lastMessage', { unique: false });

                console.log('✅ Object store created');
            }
        };
    });
}

/**
 * Save or update a conversation
 * @param {string} jid - Contact JID
 * @param {Object} conversation - Conversation data
 * @returns {Promise<void>}
 */
export function saveConversation(jid, conversation) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const data = {
            jid,
            ...conversation,
            updatedAt: Date.now()
        };

        const request = store.put(data);

        request.onsuccess = () => {
            console.log(`💾 Saved conversation: ${jid}`);
            resolve();
        };

        request.onerror = () => {
            console.error('❌ Save error:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get a single conversation by JID
 * @param {string} jid - Contact JID
 * @returns {Promise<Object|null>}
 */
export function getConversation(jid) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(jid);

        request.onsuccess = () => {
            resolve(request.result || null);
        };

        request.onerror = () => {
            console.error('❌ Get error:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get all conversations
 * @returns {Promise<Array>}
 */
export function getAllConversations() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            console.log(`📦 Loaded ${request.result.length} conversations from IndexedDB`);
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('❌ GetAll error:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Delete a conversation
 * @param {string} jid - Contact JID
 * @returns {Promise<void>}
 */
export function deleteConversation(jid) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(jid);

        request.onsuccess = () => {
            console.log(`🗑️ Deleted conversation: ${jid}`);
            resolve();
        };

        request.onerror = () => {
            console.error('❌ Delete error:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Clear all conversations (for reset/debugging)
 * @returns {Promise<void>}
 */
export function clearAllData() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Database not initialized'));
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
            console.log('🧹 All data cleared');
            resolve();
        };

        request.onerror = () => {
            console.error('❌ Clear error:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Export for debugging in console
 */
if (typeof window !== 'undefined') {
    window.DB = {
        initDB,
        saveConversation,
        getConversation,
        getAllConversations,
        deleteConversation,
        clearAllData
    };
}
