/**
 * WhatsApp Module
 * Handles WhatsApp connection and message processing
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { log } = require('./logger');
const { generateResponse } = require('./ai');

async function connectToWhatsApp(getState, setState, io) {
    const { state: authState, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: authState,
    });

    // Store sock in state
    setState({ sock });

    // Connection events
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            setState({ qrCodeData: qr, status: 'waiting_for_scan' });
            console.log('QR Code generated');
            qrcode.generate(qr, { small: true });
            io.emit('qr', qr);
            io.emit('status', 'waiting_for_scan');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom) ?
                lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut : true;

            console.log('Connection closed, reconnecting:', shouldReconnect);
            setState({ status: 'disconnected' });
            io.emit('status', 'disconnected');

            if (shouldReconnect) {
                connectToWhatsApp(getState, setState, io);
            }
        } else if (connection === 'open') {
            console.log('Opened connection');
            setState({ status: 'connected', qrCodeData: null });
            io.emit('status', 'connected');
            io.emit('qr', null);
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Message handling
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            await handleIncomingMessage(msg, getState, setState, io);
        }
    });
}

async function handleIncomingMessage(msg, getState, setState, io) {
    const state = getState();
    const remoteJid = msg.key.remoteJid;

    // Log to Frontend
    io.emit('msg_log', { direction: 'in', msg });

    if (!msg.message || msg.key.fromMe) return;

    const msgContent = msg.message;
    const text = msgContent.conversation ||
        msgContent.extendedTextMessage?.text ||
        msgContent.ephemeralMessage?.message?.extendedTextMessage?.text ||
        msgContent.ephemeralMessage?.message?.conversation;

    if (!text) return;

    console.log(`Received from ${remoteJid}: ${text}`);

    // Update conversation
    updateConversation(remoteJid, {
        id: msg.key.id,
        text,
        fromMe: false,
        timestamp: Date.now()
    }, getState, io);

    // Check pause state
    if (state.pausedChats.has(remoteJid)) {
        console.log(`AI Paused for ${remoteJid}, skipping.`);
        io.emit('log', `Skipped AI for ${remoteJid} (Paused)`);
        return;
    }

    // Process with AI
    try {
        await state.sock.sendPresenceUpdate('composing', remoteJid);

        // Build conversation history
        const conv = state.conversations[remoteJid];
        const historyMessages = [];

        if (conv?.messages?.length > 0) {
            const recentMsgs = conv.messages.slice(-5);
            for (const m of recentMsgs) {
                historyMessages.push({
                    role: m.fromMe ? 'assistant' : 'user',
                    content: m.text
                });
            }
        }

        const aiMessages = [
            { role: "system", content: state.currentConfig.systemPrompt },
            ...historyMessages,
            { role: "user", content: text }
        ];

        // Generate AI response with error handling
        const result = await generateResponse(aiMessages, state.currentConfig);

        let replyText;
        if (result.success) {
            replyText = result.text;
        } else {
            // Use fallback message on error
            replyText = result.fallback;
            io.emit('ai_error', { jid: remoteJid, error: result.error });
        }

        // Send reply with random delay (5-8 seconds) for natural feel
        const delay = 5000 + Math.random() * 3000;
        await new Promise(resolve => setTimeout(resolve, delay));

        io.emit('msg_log', { direction: 'out', remoteJid, text: replyText });
        await state.sock.sendMessage(remoteJid, { text: replyText }, { quoted: msg });
        await state.sock.sendPresenceUpdate('paused', remoteJid);

        // Update conversation with our reply
        updateConversation(remoteJid, {
            id: Date.now().toString(),
            text: replyText,
            fromMe: true,
            timestamp: Date.now()
        }, getState, io);

    } catch (error) {
        log('ERROR', 'Message Processing Error', { error: error.message, stack: error.stack });
        io.emit('log', `Error: ${error.message}`);
    }
}

function updateConversation(jid, msgObj, getState, io) {
    const state = getState();

    if (!state.conversations[jid]) {
        state.conversations[jid] = {
            jid,
            name: jid.replace('@s.whatsapp.net', ''),
            messages: [],
            lastMessage: Date.now(),
            isPaused: state.pausedChats.has(jid)
        };
    }

    if (msgObj && !state.conversations[jid].messages.some(m => m.id === msgObj.id)) {
        state.conversations[jid].messages.push(msgObj);
        if (state.conversations[jid].messages.length > 50) {
            state.conversations[jid].messages.shift();
        }
    }

    state.conversations[jid].lastMessage = msgObj?.timestamp || Date.now();
    io.emit('conversation_update', { jid, conversation: state.conversations[jid] });
}

module.exports = { connectToWhatsApp };
