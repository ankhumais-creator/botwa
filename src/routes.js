/**
 * API Routes Module
 * All Express API endpoints
 */

const { log } = require('./logger');

function setupRoutes(app, getState, io) {
    const { conversations, pausedChats, currentConfig, sock, status, qrCodeData } = getState();

    // Get status
    app.get('/api/status', (req, res) => {
        const state = getState();
        res.json({
            status: state.status,
            qr: state.qrCodeData,
            config: state.currentConfig,
            pausedChats: Array.from(state.pausedChats)
        });
    });

    // Get all conversations
    app.get('/api/conversations', (req, res) => {
        const state = getState();
        const summary = Object.values(state.conversations).map(c => ({
            jid: c.jid,
            name: c.name,
            lastMessage: c.lastMessage,
            lastText: c.messages[c.messages.length - 1]?.text || '',
            isPaused: c.isPaused
        }));
        res.json(summary);
    });

    // Get single conversation
    app.get('/api/conversation/:jid', (req, res) => {
        const { jid } = req.params;
        const state = getState();
        res.json(state.conversations[jid] || { jid, name: jid, messages: [] });
    });

    // Update contact name
    app.put('/api/contact/:jid', (req, res) => {
        const { jid } = req.params;
        const { name } = req.body;
        const state = getState();
        if (state.conversations[jid]) {
            state.conversations[jid].name = name;
            io.emit('contact_updated', { jid, name });
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Contact not found' });
        }
    });

    // Delete contact
    app.delete('/api/contact/:jid', (req, res) => {
        const { jid } = req.params;
        const state = getState();
        if (state.conversations[jid]) {
            delete state.conversations[jid];
            io.emit('contact_deleted', { jid });
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Contact not found' });
        }
    });

    // Delete message
    app.delete('/api/message', (req, res) => {
        const { jid, messageId } = req.body;
        const state = getState();
        if (state.conversations[jid]) {
            state.conversations[jid].messages = state.conversations[jid].messages.filter(m => m.id !== messageId);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Chat not found' });
        }
    });

    // Update settings
    app.post('/api/settings', (req, res) => {
        const { apiKey, baseUrl, modelName, systemPrompt } = req.body;
        const { saveConfig } = require('./config');
        const state = getState();

        Object.assign(state.currentConfig, { apiKey, baseUrl, modelName, systemPrompt });
        saveConfig(state.currentConfig, state.pausedChats);

        res.json({ success: true, config: state.currentConfig });
    });

    // Send message
    app.post('/api/send', async (req, res) => {
        const { remoteJid, text } = req.body;
        const state = getState();

        if (state.status !== 'connected' || !state.sock) {
            return res.status(500).json({ error: 'Bot not connected' });
        }

        try {
            await state.sock.sendMessage(remoteJid, { text });
            io.emit('msg_log', { direction: 'out', remoteJid, text, manual: true });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // Toggle bot (pause/resume)
    app.post('/api/toggle-bot', (req, res) => {
        const { remoteJid, action } = req.body;
        const state = getState();
        const { saveConfig } = require('./config');

        if (action === 'pause') {
            state.pausedChats.add(remoteJid);
            log('PAUSE', 'AI paused for chat', { jid: remoteJid });
        } else {
            state.pausedChats.delete(remoteJid);
            log('PAUSE', 'AI resumed for chat', { jid: remoteJid });
        }

        saveConfig(state.currentConfig, state.pausedChats);

        io.emit('paused_update', { remoteJid, isPaused: state.pausedChats.has(remoteJid) });
        res.json({ success: true, isPaused: state.pausedChats.has(remoteJid) });
    });
}

module.exports = { setupRoutes };
