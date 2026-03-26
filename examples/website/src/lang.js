/**
 * Language Switcher Module
 * Handles switching between English and Chinese (Simplified)
 */

(function() {
    'use strict';

    const LANG_STORAGE_KEY = 'hikari-lang';
    const LANG_EN = 'en';
    const LANG_ZH = 'zh';

    // Language display labels
    const LANG_LABELS = {
        en: 'EN',
        zh: '中文'
    };

    /**
     * Get the current language from localStorage or default to browser language
     */
    function getStoredLang() {
        try {
            const stored = localStorage.getItem(LANG_STORAGE_KEY);
            if (stored && (stored === LANG_EN || stored === LANG_ZH)) {
                return stored;
            }
            // Default to browser language or English
            const browserLang = navigator.language || navigator.userLanguage;
            return browserLang.startsWith('zh') ? LANG_ZH : LANG_EN;
        } catch (e) {
            return LANG_EN;
        }
    }

    /**
     * Save language preference to localStorage
     */
    function saveLang(lang) {
        try {
            localStorage.setItem(LANG_STORAGE_KEY, lang);
        } catch (e) {
            console.warn('Failed to save language preference:', e);
        }
    }

    /**
     * Apply language to the document
     */
    function applyLang(lang) {
        const app = document.getElementById('hikari-app');
        if (!app) {
            console.warn('Hikari app element not found');
            return;
        }

        // Update lang attribute
        app.setAttribute('lang', lang);
        document.documentElement.lang = lang;

        // Update language toggle button text
        updateLangToggleButton(lang);

        // Dispatch custom event for other components to listen
        const event = new CustomEvent('languagechange', {
            detail: { language: lang }
        });
        window.dispatchEvent(event);
    }

    /**
     * Update the language toggle button text
     */
    function updateLangToggleButton(lang) {
        const toggleBtn = document.getElementById('lang-toggle');
        if (!toggleBtn) return;

        // Show the opposite language (what clicking will switch to)
        const nextLang = lang === LANG_EN ? LANG_ZH : LANG_EN;
        const label = LANG_LABELS[nextLang];

        // Update button text
        toggleBtn.textContent = label;
        toggleBtn.setAttribute('title', `Switch to ${nextLang === LANG_EN ? 'English' : '中文'}`);
    }

    /**
     * Toggle between languages
     */
    function toggleLang() {
        const currentLang = getStoredLang();
        const newLang = currentLang === LANG_EN ? LANG_ZH : LANG_EN;

        saveLang(newLang);
        applyLang(newLang);
    }

    /**
     * Initialize language on page load
     */
    function initLang() {
        const lang = getStoredLang();
        applyLang(lang);

        // Set up language toggle button listener
        const toggleBtn = document.getElementById('lang-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleLang);
        }

        // Listen for storage changes (for multi-tab sync)
        window.addEventListener('storage', function(e) {
            if (e.key === LANG_STORAGE_KEY && e.newValue) {
                applyLang(e.newValue);
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLang);
    } else {
        initLang();
    }

    // Also initialize after a short delay to handle WASM hydration
    setTimeout(initLang, 100);

    // Expose toggle function globally for potential external use
    window.hikariLang = {
        toggle: toggleLang,
        set: function(lang) {
            if (lang === LANG_EN || lang === LANG_ZH) {
                saveLang(lang);
                applyLang(lang);
            }
        },
        get: getStoredLang
    };
})();
