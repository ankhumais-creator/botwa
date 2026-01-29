/**
 * AI Module
 * Handles AI client creation and response generation with error handling
 */

const OpenAI = require('openai');
const { log } = require('./logger');

// Create AI client instance
function getAIClient(config) {
    return new OpenAI({
        baseURL: config.baseUrl,
        apiKey: config.apiKey
    });
}

// Generate AI response with timeout and error handling
async function generateResponse(messages, config, timeoutMs = 30000) {
    const client = getAIClient(config);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        log('AI', 'Sending to AI', { messageCount: messages.length });

        const completion = await client.chat.completions.create({
            messages,
            model: config.modelName,
        }, { signal: controller.signal });

        const text = completion.choices[0].message.content;
        log('AI', 'Got response', { preview: text.substring(0, 100) });

        return {
            success: true,
            text
        };
    } catch (err) {
        log('ERROR', 'AI Error', { error: err.message });

        // Determine error type for better user feedback
        let fallbackMessage = 'Maaf, terjadi kesalahan. Silakan coba lagi.';

        if (err.name === 'AbortError') {
            fallbackMessage = 'Maaf, permintaan timeout. Server AI sedang sibuk.';
        } else if (err.status === 429) {
            fallbackMessage = 'Maaf, rate limit tercapai. Tunggu sebentar.';
        } else if (err.status === 401) {
            fallbackMessage = 'Konfigurasi AI tidak valid. Hubungi admin.';
        }

        return {
            success: false,
            error: err.message,
            fallback: fallbackMessage
        };
    } finally {
        clearTimeout(timeout);
    }
}

module.exports = { getAIClient, generateResponse };
