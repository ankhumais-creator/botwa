/**
 * Logger Module
 * Centralized debug logging
 */

const DEBUG = true;

function log(category, message, data = null) {
    if (!DEBUG) return;
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${category}]`;
    if (data) {
        console.log(prefix, message, JSON.stringify(data, null, 2));
    } else {
        console.log(prefix, message);
    }
}

module.exports = { log, DEBUG };
