/**
 * Language Switcher Module
 * Handles switching between 9 supported languages
 */

(function() {
    'use strict';

    const LANG_STORAGE_KEY = 'hikari-lang';

    // Supported languages with their display names and native names
    const LANGUAGES = {
        'en-US': { name: 'English', nativeName: 'English' },
        'zh-CHS': { name: 'Chinese (Simplified)', nativeName: '简体中文' },
        'zh-CHT': { name: 'Chinese (Traditional)', nativeName: '繁體中文' },
        'fr-FR': { name: 'French', nativeName: 'Français' },
        'ru-RU': { name: 'Russian', nativeName: 'Русский' },
        'es-ES': { name: 'Spanish', nativeName: 'Español' },
        'ar-SA': { name: 'Arabic', nativeName: 'العربية' },
        'ja-JP': { name: 'Japanese', nativeName: '日本語' },
        'ko-KR': { name: 'Korean', nativeName: '한국어' }
    };

    // Language to locale code mapping for RTL support
    const RTL_LANGUAGES = ['ar-SA'];

    // Default language
    const DEFAULT_LANG = 'en-US';

    // Currently loaded translations
    let currentTranslations = null;
    let currentLangCode = null;

    /**
     * Get the current language from localStorage or default to browser language
     */
    function getStoredLang() {
        try {
            const stored = localStorage.getItem(LANG_STORAGE_KEY);
            if (stored && LANGUAGES[stored]) {
                return stored;
            }
            // Try to match browser language
            const browserLang = navigator.language || navigator.userLanguage || '';

            // Check for exact match first
            if (LANGUAGES[browserLang]) {
                return browserLang;
            }

            // Check for partial match (e.g., 'zh' matches 'zh-CHS')
            const langPrefix = browserLang.split('-')[0];
            for (const [code, info] of Object.entries(LANGUAGES)) {
                if (code.startsWith(langPrefix)) {
                    return code;
                }
            }

            return DEFAULT_LANG;
        } catch (e) {
            return DEFAULT_LANG;
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
     * Load translation file for the given language
     */
    function loadTranslations(langCode) {
        return new Promise((resolve, reject) => {
            // Normalize language code for file naming (replace hyphens with underscores)
            const fileName = langCode.replace('-', '_');
            const script = document.createElement('script');
            script.src = `/i18n/${langCode}/translations.js`;
            script.onload = () => {
                const translationKey = `hikariTranslations_${fileName}`;
                if (window[translationKey]) {
                    resolve(window[translationKey]);
                } else {
                    reject(new Error(`Translation key ${translationKey} not found`));
                }
            };
            script.onerror = () => reject(new Error(`Failed to load translations for ${langCode}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Apply language to the document
     */
    async function applyLang(lang) {
        const app = document.getElementById('hikari-app');
        if (!app) {
            console.warn('Hikari app element not found');
            return;
        }

        // Load translations if not already loaded
        if (currentLangCode !== lang) {
            try {
                currentTranslations = await loadTranslations(lang);
                currentLangCode = lang;
            } catch (e) {
                console.error('Failed to load translations:', e);
                // Fall back to default language
                if (lang !== DEFAULT_LANG) {
                    await applyLang(DEFAULT_LANG);
                    return;
                }
            }
        }

        // Update lang attribute
        app.setAttribute('lang', lang);
        document.documentElement.lang = lang;

        // Handle RTL languages
        const isRTL = RTL_LANGUAGES.includes(lang);
        document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
        app.setAttribute('dir', isRTL ? 'rtl' : 'ltr');

        // Update language selector
        updateLanguageSelector(lang);

        // Dispatch custom event for other components to listen
        const event = new CustomEvent('languagechange', {
            detail: {
                language: lang,
                translations: currentTranslations
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Get translation for a given key path
     * @param {string} key - Dot-separated key path (e.g., 'common.button.submit')
     * @returns {string} - The translated text or the key if not found
     */
    function t(key) {
        if (!currentTranslations) {
            return key;
        }

        const keys = key.split('.');
        let value = currentTranslations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return key;
            }
        }

        return typeof value === 'string' ? value : key;
    }

    /**
     * Create or update the language selector dropdown
     */
    function updateLanguageSelector(currentLang) {
        let selector = document.getElementById('lang-selector');

        // Create selector if it doesn't exist
        if (!selector) {
            const container = document.getElementById('hikari-app');
            if (!container) return;

            // Find or create header for language selector
            const header = container.querySelector('[data-header]') || container.firstChild;
            if (!header) return;

            selector = document.createElement('select');
            selector.id = 'lang-selector';
            selector.className = 'hi-lang-selector';
            selector.setAttribute('aria-label', 'Select Language');

            // Add styling for the selector
            const style = document.createElement('style');
            style.textContent = `
                .hi-lang-selector {
                    display: inline-flex;
                    align-items: center;
                    height: 36px;
                    margin-left: 8px;
                    padding: 0 8px;
                    background: transparent;
                    border: 1px solid var(--hi-color-border-primary, #e2e8f0);
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--hi-color-text-primary, #475569);
                    transition: background-color 0.2s, color 0.2s, border-color 0.2s;
                }
                .hi-lang-selector:hover {
                    background-color: var(--hi-color-bg-tertiary, #f1f5f9);
                    border-color: var(--hi-color-border-secondary, #cbd5e1);
                }
                .hi-lang-selector:focus-visible {
                    outline: 2px solid var(--hi-color-border-focus, #4a9eff);
                    outline-offset: 2px;
                }
            `;
            document.head.appendChild(style);

            // Add event listener
            selector.addEventListener('change', function() {
                const newLang = this.value;
                saveLang(newLang);
                applyLang(newLang);
            });
        }

        // Populate options
        selector.innerHTML = '';
        for (const [code, info] of Object.entries(LANGUAGES)) {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = info.nativeName;
            option.selected = code === currentLang;
            selector.appendChild(option);
        }

        // Insert selector into the DOM if not already there
        if (!document.getElementById('lang-selector')) {
            // Try to find a suitable place to insert it
            const themeToggle = document.getElementById('theme-toggle');
            if (themeToggle && themeToggle.parentNode) {
                themeToggle.parentNode.insertBefore(selector, themeToggle.nextSibling);
            }
        }
    }

    /**
     * Set a specific language
     */
    function setLang(lang) {
        if (LANGUAGES[lang]) {
            saveLang(lang);
            applyLang(lang);
        }
    }

    /**
     * Get the current language code
     */
    function getCurrentLang() {
        return getStoredLang();
    }

    /**
     * Get all supported languages
     */
    function getSupportedLanguages() {
        return { ...LANGUAGES };
    }

    /**
     * Initialize language on page load
     */
    async function initLang() {
        const lang = getStoredLang();
        await applyLang(lang);

        // Listen for storage changes (for multi-tab sync)
        window.addEventListener('storage', function(e) {
            if (e.key === LANG_STORAGE_KEY && e.newValue && e.newValue !== currentLangCode) {
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

    // Expose API globally
    window.hikariLang = {
        set: setLang,
        get: getCurrentLang,
        getSupportedLanguages: getSupportedLanguages,
        t: t,
        current: currentLangCode
    };

    // Make translations available globally for WASM interop
    window.hikariGetTranslation = t;
    window.hikariGetCurrentTranslations = () => currentTranslations;
})();
