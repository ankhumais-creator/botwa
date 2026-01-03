
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const OpenAI = require('openai');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// --- Configuration & State ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve the dashboard

let sock;
let currentConfig = {
    apiKey: process.env.API_KEY,
    baseUrl: process.env.BASE_URL || 'https://openrouter.ai/api/v1',
    modelName: process.env.MODEL_NAME || 'google/gemma-3n-e4b-it', // Default generic
    systemPrompt: "You are a helpful and concise WhatsApp assistant. You answer in Indonesian."
};
let qrCodeData = null;
let status = 'disconnected';
const pausedChats = new Set(); // Track chats where AI is disabled

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
                // Determine if we should reply (Simple Logic for now: Reply all except Status/Groups if needed)
                // For CS tool, we might want to filter groups. For now, reply all.

                await sock.sendPresenceUpdate('composing', remoteJid);

                const client = getAIClient();
                const completion = await client.chat.completions.create({
                    messages: [
                        { role: "system", content: currentConfig.systemPrompt },
                        { role: "user", content: text }
                    ],
                    model: currentConfig.modelName,
                });

                const replyText = completion.choices[0].message.content;

                // Emit Bot Reply to UI
                io.emit('msg_log', { direction: 'out', remoteJid, text: replyText });

                await sock.sendMessage(remoteJid, { text: replyText }, { quoted: msg });
                await sock.sendPresenceUpdate('paused', remoteJid);

            } catch (error) {
                console.error('AI Processing Error:', error);
                io.emit('log', `Error: ${error.message}`);
            }
        }
    });
}

// --- API Endpoints ---
app.get('/api/status', (req, res) => {
    res.json({ status, qr: qrCodeData, config: currentConfig, pausedChats: Array.from(pausedChats) });
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
    if (!status === 'connected' || !sock) return res.status(500).json({ error: 'Bot not connected' });

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
    } else {
        pausedChats.delete(remoteJid);
    }

    io.emit('paused_update', { remoteJid, isPaused: pausedChats.has(remoteJid) });
    res.json({ success: true, isPaused: pausedChats.has(remoteJid) });
});

// --- Start ---
connectToWhatsApp();

server.listen(3000, () => {
    console.log('✅ Server running on http://localhost:3000');
});
