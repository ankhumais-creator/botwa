/**
 * E2E Test: Chat History Persistence with IndexedDB
 * 
 * Tests that chat conversations and messages persist after page reload
 */

const { test, expect } = require('@playwright/test');

test.describe('Chat Persistence', () => {
    test('should persist chat history after page reload', async ({ page, context }) => {
        // Step 1: Navigate to app
        await page.goto('http://localhost:3000');

        // Wait for database initialization
        await page.waitForFunction(() => {
            return globalThis.DB !== undefined;
        }, { timeout: 5000 });

        console.log('✅ Database module loaded');

        // Step 2: Clear IndexedDB for clean test
        await page.evaluate(async () => {
            await globalThis.DB.clearAllData();
        });

        console.log('🧹 Cleared IndexedDB');

        // Step 3: Create new chat
        const testNumber = '628123456789';
        await page.click('#btn-new-chat');
        await page.fill('#new-chat-input', testNumber);
        await page.click('#btn-start-chat');

        // Wait for chat to open
        await page.waitForSelector('#chat-container:not(.hidden)', { timeout: 5000 });
        console.log('✅ Chat opened');

        // Step 4: Send test messages
        const testMessages = [
            'Hello, this is message 1',
            'Testing persistence with message 2',
            'Final test message 3'
        ];

        for (const msg of testMessages) {
            await page.fill('#message-input', msg);
            await page.click('#btn-send-message');
            await page.waitForTimeout(500); // Wait for message to be sent
        }

        console.log(`✅ Sent ${testMessages.length} messages`);

        // Step 5: Verify messages in IndexedDB
        const dbData = await page.evaluate(async () => {
            const conversations = await globalThis.DB.getAllConversations();
            return conversations;
        });

        expect(dbData.length).toBeGreaterThan(0);
        console.log(`✅ IndexedDB has ${dbData.length} conversation(s)`);

        const testConv = dbData.find(c => c.jid.includes(testNumber));
        expect(testConv).toBeDefined();
        expect(testConv.messages).toBeDefined();
        console.log(`✅ Conversation has ${testConv.messages?.length || 0} messages`);

        // Step 6: Reload page
        await page.reload();

        // Wait for app to reinitialize
        await page.waitForFunction(() => {
            return globalThis.DB !== undefined;
        }, { timeout: 5000 });

        console.log('🔄 Page reloaded, database reinitialized');

        // Step 7: Verify chat still exists in sidebar
        const contactExists = await page.locator('.contact-item').count();
        expect(contactExists).toBeGreaterThan(0);
        console.log(`✅ Found ${contactExists} contact(s) in sidebar after reload`);

        // Step 8: Click on the chat to open it
        await page.click('.contact-item');

        // Wait for messages to render
        await page.waitForSelector('.msg-row', { timeout: 5000 });

        // Step 9: Verify messages are visible
        const messageCount = await page.locator('.msg-row').count();
        expect(messageCount).toBeGreaterThan(0);
        console.log(`✅ Found ${messageCount} message(s) after reload`);

        // Verify at least one of our test messages is visible
        const messageTexts = await page.locator('.msg-row .whitespace-pre-wrap').allTextContents();
        const hasTestMessage = messageTexts.some(text =>
            testMessages.some(testMsg => text.includes(testMsg))
        );
        expect(hasTestMessage).toBe(true);
        console.log('✅ Test messages persisted correctly');

        // Step 10: Verify IndexedDB still has data
        const dbDataAfterReload = await page.evaluate(async () => {
            const conversations = await globalThis.DB.getAllConversations();
            return conversations;
        });

        expect(dbDataAfterReload.length).toBeGreaterThan(0);
        console.log('✅ IndexedDB data intact after reload');

        console.log('🎉 PERSISTENCE TEST PASSED!');
    });

    test('should handle empty state when no chats exist', async ({ page }) => {
        await page.goto('http://localhost:3000');

        // Clear all data
        await page.waitForFunction(() => globalThis.DB !== undefined, { timeout: 5000 });
        await page.evaluate(async () => {
            await globalThis.DB.clearAllData();
        });

        await page.reload();

        // Should show empty state
        const emptyState = await page.locator('#empty-contacts').isVisible();
        expect(emptyState).toBe(true);
        console.log('✅ Empty state shown correctly');
    });
});
