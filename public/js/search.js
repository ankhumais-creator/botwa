/**
 * Message Search Functionality
 * Handles in-chat message searching and navigation
 */

import { els, escapeRegex } from './dom.js';
import * as state from './state.js';

// ============ TOGGLE SEARCH ============
export function toggleMessageSearch() {
    const searchBar = document.getElementById('search-bar');
    const searchInput = document.getElementById('search-messages-input');

    if (searchBar.classList.contains('hidden')) {
        searchBar.classList.remove('hidden');
        searchInput.value = '';
        searchInput.focus();
        state.setSearchResults([]);
        state.setCurrentSearchIndex(-1);
        state.setSearchQuery('');
    } else {
        searchBar.classList.add('hidden');
        clearSearchHighlights();
        state.setSearchResults([]);
        state.setCurrentSearchIndex(-1);
        state.setSearchQuery('');
        updateSearchCounter();
    }
}

// ============ SEARCH MESSAGES ============
export function searchMessages(query) {
    clearSearchHighlights();
    state.setSearchResults([]);
    state.setCurrentSearchIndex(-1);

    if (!query || query.length < 2) {
        state.setSearchQuery('');
        updateSearchCounter();
        return;
    }

    state.setSearchQuery(query);
    const messagesContainer = els.messages;
    const messageElements = messagesContainer.querySelectorAll('.msg-row');

    messageElements.forEach((msgEl, index) => {
        const textDiv = msgEl.querySelector('.whitespace-pre-wrap');
        if (textDiv) {
            const text = textDiv.textContent || '';
            if (text.toLowerCase().includes(query.toLowerCase())) {
                state.searchResults.push({
                    element: msgEl,
                    textDiv: textDiv,
                    text: text,
                    index: index
                });
            }
        }
    });

    if (state.searchResults.length > 0) {
        // Highlight all results
        state.searchResults.forEach((result) => {
            highlightText(result.textDiv, result.text, state.searchQuery);
        });

        // Set first result as active
        state.setCurrentSearchIndex(0);
        setActiveSearchResult();
    }

    updateSearchCounter();
}

// ============ HIGHLIGHT TEXT ============
export function highlightText(element, text, query) {
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    element.innerHTML = text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

// ============ SET ACTIVE SEARCH RESULT ============
export function setActiveSearchResult() {
    // Remove previous active
    document.querySelectorAll('.search-highlight-active').forEach(el => {
        el.classList.remove('search-highlight-active');
    });

    if (state.currentSearchIndex >= 0 && state.currentSearchIndex < state.searchResults.length) {
        const result = state.searchResults[state.currentSearchIndex];

        // Add active class to current result
        const highlights = result.textDiv.querySelectorAll('.search-highlight');
        highlights.forEach(h => h.classList.add('search-highlight-active'));

        // Scroll into view
        result.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        updateSearchCounter();
    }
}

// ============ NAVIGATE SEARCH RESULTS ============
export function navigateSearchResult(direction) {
    if (state.searchResults.length === 0) return;

    if (direction === 'next') {
        state.setCurrentSearchIndex((state.currentSearchIndex + 1) % state.searchResults.length);
    } else {
        state.setCurrentSearchIndex((state.currentSearchIndex - 1 + state.searchResults.length) % state.searchResults.length);
    }

    setActiveSearchResult();
}

// ============ CLEAR SEARCH HIGHLIGHTS ============
export function clearSearchHighlights() {
    const highlights = document.querySelectorAll('.search-highlight, .search-highlight-active');
    highlights.forEach(el => {
        const parent = el.parentNode;
        if (parent) {
            // Get original text
            const text = el.textContent;
            const textNode = document.createTextNode(text);
            el.replaceWith(textNode);
            // Normalize to merge adjacent text nodes
            parent.normalize();
        }
    });
}

// ============ UPDATE SEARCH COUNTER ============
export function updateSearchCounter() {
    const counterEl = document.getElementById('search-counter');
    if (!counterEl) return;

    if (state.searchResults.length === 0) {
        if (state.searchQuery && state.searchQuery.length >= 2) {
            counterEl.textContent = '0 results';
        } else {
            counterEl.textContent = '';
        }
    } else {
        counterEl.textContent = `${state.currentSearchIndex + 1} of ${state.searchResults.length}`;
    }
}
