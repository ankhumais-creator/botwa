
const express = require('express');
const http = require('node:http');
const { Server } = require('socket.io');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const OpenAI = require('openai');
const cors = require('cors');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

// --- Debug Logger ---
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

// --- Configuration & State ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Disable browser cache for all files
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

app.use(express.static('public')); // Serve the dashboard

// --- Load Config from file ---
function loadConfig() {
    try {
        const configPath = path.join(__dirname, 'config.json');
        if (fs.existsSync(configPath)) {
            const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            log('CONFIG', 'Loaded config.json', saved);
            return saved;
        }
    } catch (e) {
        log('CONFIG', 'Error loading config.json', { error: e.message });
    }
    return null;
}

function saveConfig() {
    try {
        const configPath = path.join(__dirname, 'config.json');
        const toSave = {
            ...currentConfig,
            pausedChats: Array.from(pausedChats)
        };
        fs.writeFileSync(configPath, JSON.stringify(toSave, null, 2));
        log('CONFIG', 'Saved config.json');
    } catch (e) {
        log('CONFIG', 'Error saving config.json', { error: e.message });
    }
}

const savedConfig = loadConfig();

let sock;
let currentConfig = {
    apiKey: savedConfig?.apiKey || process.env.API_KEY,
    baseUrl: savedConfig?.baseUrl || process.env.BASE_URL || 'https://openrouter.ai/api/v1',
    modelName: savedConfig?.modelName || process.env.MODEL_NAME || 'google/gemma-3n-e4b-it',
    systemPrompt: savedConfig?.systemPrompt || "You are a helpful and concise WhatsApp assistant. You answer in Indonesian."
};
let qrCodeData = null;
let status = 'disconnected';

// Load pausedChats from saved config
const pausedChats = new Set(savedConfig?.pausedChats || []);
log('INIT', 'Loaded pausedChats', { count: pausedChats.size, chats: Array.from(pausedChats) });

const conversations = {}; // JID -> { jid, name, messages, lastMessage, isPaused }

// Helper to update conversation and notify frontend
function updateConversation(jid, msgObj) {
    if (!conversations[jid]) {
        conversations[jid] = { jid, name: jid.replace('@s.whatsapp.net', ''), messages: [], lastMessage: Date.now(), isPaused: pausedChats.has(jid) };
    }
    if (msgObj && !conversations[jid].messages.some(m => m.id === msgObj.id)) {
        conversations[jid].messages.push(msgObj);
        if (conversations[jid].messages.length > 50) conversations[jid].messages.shift();
    }
    conversations[jid].lastMessage = msgObj?.timestamp || Date.now();
    io.emit('conversation_update', { jid, conversation: conversations[jid] });
}

// --- OpenAI Client Factory ---
function getAIClient() {
    return new OpenAI({
        baseURL: currentConfig.baseUrl,
        apiKey: currentConfig.apiKey
    });
}

// --- WhatsApp Logic ---
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrCodeData = qr;
            console.log('QR Code generated');
            qrcode.generate(qr, { small: true });
            io.emit('qr', qr);
            status = 'waiting_for_scan';
            io.emit('status', status);
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) ?
                lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut : true;

            console.log('Connection closed, reconnecting:', shouldReconnect);
            status = 'disconnected';
            io.emit('status', status);

            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Opened connection');
            status = 'connected';
            qrCodeData = null; // Clear QR
            io.emit('status', status);
            io.emit('qr', null);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            const remoteJid = msg.key.remoteJid;

            // Log to Frontend
            io.emit('msg_log', { direction: 'in', msg });

            if (!msg.message || msg.key.fromMe) continue;

            const msgContent = msg.message;
            const text = msgContent.conversation ||
                msgContent.extendedTextMessage?.text ||
                msgContent.ephemeralMessage?.message?.extendedTextMessage?.text ||
                msgContent.ephemeralMessage?.message?.conversation;

            if (!text) continue;

            console.log(`Received from ${remoteJid}: ${text}`);

            // CHECK PAUSE STATE
            if (pausedChats.has(remoteJid)) {
                console.log(`AI Paused for ${remoteJid}, skipping.`);
                io.emit('log', `Skipped AI for ${remoteJid} (Paused)`);
                continue;
            }

            try {
                await sock.sendPresenceUpdate('composing', remoteJid);

                // Build conversation history for context
                const conv = conversations[remoteJid];
                const historyMessages = [];

                if (conv && conv.messages.length > 0) {
                    // Get last 5 messages for context
                    const recentMsgs = conv.messages.slice(-5);
                    for (const m of recentMsgs) {
                        historyMessages.push({
                            role: m.fromMe ? 'assistant' : 'user',
                            content: m.text
                        });
                    }
                }

                const aiMessages = [
                    { role: "system", content: currentConfig.systemPrompt },
                    ...historyMessages,
                    { role: "user", content: text }
                ];

                log('AI', 'Sending to AI', { jid: remoteJid, messageCount: aiMessages.length });

                const client = getAIClient();
                const completion = await client.chat.completions.create({
                    messages: aiMessages,
                    model: currentConfig.modelName,
                });

                const replyText = completion.choices[0].message.content;
                log('AI', 'Got response', { jid: remoteJid, reply: replyText.substring(0, 100) });

                // Emit Bot Reply to UI
                io.emit('msg_log', { direction: 'out', remoteJid, text: replyText });

                await sock.sendMessage(remoteJid, { text: replyText }, { quoted: msg });
                await sock.sendPresenceUpdate('paused', remoteJid);

            } catch (error) {
                log('ERROR', 'AI Processing Error', { error: error.message, stack: error.stack });
                io.emit('log', `Error: ${error.message}`);
            }
        }
    });
}

// --- API Endpoints ---
app.get('/api/status', (req, res) => {
    res.json({ status, qr: qrCodeData, config: currentConfig, pausedChats: Array.from(pausedChats) });
});

app.get('/api/conversations', (req, res) => {
    const summary = Object.values(conversations).map(c => ({
        jid: c.jid,
        name: c.name,
        lastMessage: c.lastMessage,
        lastText: c.messages[c.messages.length - 1]?.text || '',
        isPaused: c.isPaused
    }));
    res.json(summary);
});

app.get('/api/conversation/:jid', (req, res) => {
    const { jid } = req.params;
    res.json(conversations[jid] || { jid, name: jid, messages: [] });
});

app.put('/api/contact/:jid', (req, res) => {
    const { jid } = req.params;
    const { name } = req.body;
    if (conversations[jid]) {
        conversations[jid].name = name;
        io.emit('contact_updated', { jid, name });
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Contact not found' });
    }
});

app.delete('/api/contact/:jid', (req, res) => {
    const { jid } = req.params;
    if (conversations[jid]) {
        delete conversations[jid];
        io.emit('contact_deleted', { jid });
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Contact not found' });
    }
});

app.delete('/api/message', (req, res) => {
    const { jid, messageId } = req.body;
    if (conversations[jid]) {
        conversations[jid].messages = conversations[jid].messages.filter(m => m.id !== messageId);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Chat not found' });
    }
});

app.post('/api/settings', (req, res) => {
    const { apiKey, baseUrl, modelName, systemPrompt } = req.body;
    currentConfig = { ...currentConfig, apiKey, baseUrl, modelName, systemPrompt };

    // Update .env file for persistence (optional, but good for restart)
    const envContent = `API_KEY=${apiKey}\nBASE_URL=${baseUrl}\nMODEL_NAME=${modelName}`;
    fs.writeFileSync('.env', envContent);

    res.json({ success: true, config: currentConfig });
});

app.post('/api/send', async (req, res) => {
    const { remoteJid, text } = req.body;
    if (status !== 'connected' || !sock) return res.status(500).json({ error: 'Bot not connected' });

    try {
        await sock.sendMessage(remoteJid, { text });
        io.emit('msg_log', { direction: 'out', remoteJid, text, manual: true });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/toggle-bot', (req, res) => {
    const { remoteJid, action } = req.body; // action: 'pause' or 'resume'

    if (action === 'pause') {
        pausedChats.add(remoteJid);
        log('PAUSE', 'AI paused for chat', { jid: remoteJid });
    } else {
        pausedChats.delete(remoteJid);
        log('PAUSE', 'AI resumed for chat', { jid: remoteJid });
    }

    // Save to config.json for persistence
    saveConfig();

    io.emit('paused_update', { remoteJid, isPaused: pausedChats.has(remoteJid) });
    res.json({ success: true, isPaused: pausedChats.has(remoteJid) });
});

// --- Start ---
connectToWhatsApp();

server.listen(3000, () => {
    console.log('✅ Server running on http://localhost:3000');
});
