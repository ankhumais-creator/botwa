// @ts-check
import { test, expect } from '@playwright/test';

test.describe('WhatsApp Web Clone Dashboard', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('should load dashboard with correct styling', async ({ page }) => {
        // Check page title
        await expect(page).toHaveTitle('WhatsApp Web');

        // Check green top bar exists
        const greenBar = page.locator(String.raw`.bg-\[\#00a884\]`).first();
        await expect(greenBar).toBeVisible();

        // Check main container exists
        const mainContainer = page.locator(String.raw`.max-w-\[1600px\]`);
        await expect(mainContainer).toBeVisible();
    });

    test('should show welcome screen initially', async ({ page }) => {
        const welcomeScreen = page.locator('#welcome-screen');
        await expect(welcomeScreen).toBeVisible();

        // Check welcome text
        await expect(page.getByText('WhatsApp Web AI')).toBeVisible();
        await expect(page.getByText('Send and receive messages with AI assistance.')).toBeVisible();
    });

    test('should show empty contacts state', async ({ page }) => {
        const emptyContacts = page.locator('#empty-contacts');
        await expect(emptyContacts).toBeVisible();
        await expect(page.getByText('No chats yet')).toBeVisible();
    });

    test('should open settings panel when clicking settings button', async ({ page }) => {
        // Settings panel should be hidden initially
        const settingsPanel = page.locator('#settings-panel');
        await expect(settingsPanel).toBeHidden();

        // Click the settings button (three dots)
        await page.locator('button[title="Settings"]').click();

        // Settings panel should be visible now
        await expect(settingsPanel).toBeVisible();

        // Check settings header
        await expect(page.getByText('Settings')).toBeVisible();
    });

    test('should have all config fields in settings', async ({ page }) => {
        // Open settings
        await page.locator('button[title="Settings"]').click();

        // Check all input fields exist
        await expect(page.locator('#inp-model')).toBeVisible();
        await expect(page.locator('#inp-prompt')).toBeVisible();
        await expect(page.locator('#inp-url')).toBeVisible();
        await expect(page.locator('#inp-key')).toBeVisible();

        // Check buttons
        await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Shutdown System' })).toBeVisible();
    });

    test('should close settings panel when clicking back arrow', async ({ page }) => {
        // Open settings
        await page.locator('button[title="Settings"]').click();
        const settingsPanel = page.locator('#settings-panel');
        await expect(settingsPanel).toBeVisible();

        // Click back arrow (first button inside settings header)
        await settingsPanel.locator('button').first().click();

        // Settings should be hidden
        await expect(settingsPanel).toBeHidden();
    });

    test('should trigger new chat dialog when clicking new chat button', async ({ page }) => {
        // Set up dialog handler
        let dialogMessage = '';
        page.on('dialog', async dialog => {
            dialogMessage = dialog.message();
            await dialog.dismiss();
        });

        // Click new chat button
        await page.locator('button[title="New chat"]').click();

        // Wait a moment for dialog
        await page.waitForTimeout(500);

        // Check dialog was triggered
        expect(dialogMessage).toContain('phone number');
    });

    test('should have search input functional', async ({ page }) => {
        const searchInput = page.locator('#search-input');
        await expect(searchInput).toBeVisible();

        // Type in search
        await searchInput.fill('test');
        await expect(searchInput).toHaveValue('test');
    });

    test('should have message input disabled when no chat selected', async ({ page }) => {
        // Chat container should be hidden initially
        const chatContainer = page.locator('#chat-container');
        await expect(chatContainer).toBeHidden();
    });

});
