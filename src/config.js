/**
 * Configuration Module
 * Handles loading/saving config from config.json
 */

const fs = require('node:fs');
const path = require('node:path');
const { log } = require('./logger');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

// Load config from file
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
            log('CONFIG', 'Loaded config.json', saved);
            return saved;
        }
    } catch (e) {
        log('CONFIG', 'Error loading config.json', { error: e.message });
    }
    return null;
}

// Save config to file
function saveConfig(currentConfig, pausedChats) {
    try {
        const toSave = {
            ...currentConfig,
            pausedChats: Array.from(pausedChats)
        };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(toSave, null, 2));
        log('CONFIG', 'Saved config.json');
    } catch (e) {
        log('CONFIG', 'Error saving config.json', { error: e.message });
    }
}

// Initialize config with defaults
function initConfig(savedConfig) {
    return {
        apiKey: savedConfig?.apiKey || process.env.API_KEY,
        baseUrl: savedConfig?.baseUrl || process.env.BASE_URL || 'https://openrouter.ai/api/v1',
        modelName: savedConfig?.modelName || process.env.MODEL_NAME || 'google/gemma-3n-e4b-it',
        systemPrompt: savedConfig?.systemPrompt || "You are a helpful and concise WhatsApp assistant. You answer in Indonesian."
    };
}

module.exports = { loadConfig, saveConfig, initConfig };
