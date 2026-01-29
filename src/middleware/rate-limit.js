/**
 * Rate Limiting Middleware
 * Prevents API spam and abuse
 */

const rateLimit = require('express-rate-limit');

// General API rate limiter (60 requests per minute)
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Stricter rate limiter for AI-related endpoints (10 requests per minute)
const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { error: 'AI rate limit reached. Please wait a moment.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Settings rate limiter (5 requests per minute - prevent spam saves)
const settingsLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: 'Too many settings changes. Please wait.' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = { apiLimiter, aiLimiter, settingsLimiter };
