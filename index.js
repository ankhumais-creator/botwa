/**
 * WhatsApp Bot - Main Entry Point
 * Modular architecture with production hardening
 */

require('dotenv').config();
const express = require('express');
const http = require('node:http');
const { Server } = require('socket.io');
const cors = require('cors');

const { log } = require('./src/logger');
const { loadConfig, initConfig } = require('./src/config');
const { setupRoutes } = require('./src/routes');
const { connectToWhatsApp } = require('./src/whatsapp');
const { apiLimiter } = require('./src/middleware/rate-limit');

// --- Initialize Express ---
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Disable browser cache
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
});

app.use(express.static('public'));

// Apply rate limiting to API routes
app.use('/api', apiLimiter);

// --- Shared State ---
const savedConfig = loadConfig();
const state = {
    sock: null,
    currentConfig: initConfig(savedConfig),
    qrCodeData: null,
    status: 'disconnected',
    pausedChats: new Set(savedConfig?.pausedChats || []),
    conversations: {}
};

log('INIT', 'Loaded pausedChats', { count: state.pausedChats.size });

// State accessors for modules
const getState = () => state;
const setState = (updates) => Object.assign(state, updates);

// --- Setup Routes ---
setupRoutes(app, getState, io);

// --- Start WhatsApp ---
connectToWhatsApp(getState, setState, io);

// --- Start Server ---
server.listen(3000, () => {
    console.log('✅ Server running on http://localhost:3000');
});
