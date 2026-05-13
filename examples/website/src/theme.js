/**
 * Theme Switcher Module
 * Handles switching between Hikari (light) and Tairitsu (dark) themes
 */

(function() {
    'use strict';

    const THEME_STORAGE_KEY = 'hikari-theme';
    const THEME_HIKARI = 'hikari';
    const THEME_TAIRITSU = 'tairitsu';

    /**
     * Get the current theme from localStorage or default to hikari
     */
    function getStoredTheme() {
        try {
            return localStorage.getItem(THEME_STORAGE_KEY) || THEME_HIKARI;
        } catch (e) {
            return THEME_HIKARI;
        }
    }

    /**
     * Save theme preference to localStorage
     */
    function saveTheme(theme) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch (e) {
            console.warn('Failed to save theme preference:', e);
        }
    }

    /**
     * Apply theme to the document
     */
    function applyTheme(theme) {
        const app = document.getElementById('hikari-app');
        if (!app) {
            console.warn('Hikari app element not found');
            return;
        }

        // Update data-theme attribute
        app.setAttribute('data-theme', theme);

        // Update layout class
        const layoutClass = theme === THEME_TAIRITSU ? 'hi-layout-dark' : 'hi-layout-light';
        app.classList.remove('hi-layout-light', 'hi-layout-dark');
        app.classList.add(layoutClass);

        // Update CSS variables on :root
        const root = document.documentElement;
        if (theme === THEME_TAIRITSU) {
            root.style.setProperty('--hi-color-primary', '#ff6b9d');
            root.style.setProperty('--hi-color-secondary', '#c084fc');
            root.style.setProperty('--hi-color-accent', '#f472b6');
            root.style.setProperty('--hi-color-success', '#a78bfa');
            root.style.setProperty('--hi-color-warning', '#fbbf24');
            root.style.setProperty('--hi-color-error', '#f87171');
            root.style.setProperty('--hi-color-info', '#60a5fa');

            // Background colors
            root.style.setProperty('--hi-color-bg-primary', '#0f0f1a');
            root.style.setProperty('--hi-color-bg-secondary', '#1a1a2e');
            root.style.setProperty('--hi-color-bg-tertiary', '#252540');
            root.style.setProperty('--hi-color-bg-elevated', '#2d2d4a');

            // Text colors
            root.style.setProperty('--hi-color-text-primary', '#f0f0f5');
            root.style.setProperty('--hi-color-text-secondary', '#c0c0d0');
            root.style.setProperty('--hi-color-text-tertiary', '#8080a0');
            root.style.setProperty('--hi-color-text-disabled', '#505070');

            // Border colors
            root.style.setProperty('--hi-color-border-primary', '#3a3a5a');
            root.style.setProperty('--hi-color-border-secondary', '#4a4a6a');
            root.style.setProperty('--hi-color-border-focus', '#ff6b9d');

            // Shadow
            root.style.setProperty('--hi-color-shadow', 'rgba(0, 0, 0, 0.4)');

            // Surface colors
            root.style.setProperty('--hi-color-surface-primary', '#1a1a2e');
            root.style.setProperty('--hi-color-surface-secondary', '#252540');
            root.style.setProperty('--hi-color-surface-tertiary', '#2d2d4a');

            // Component specific
            root.style.setProperty('--hi-color-header-bg', 'rgba(15, 15, 26, 0.95)');
            root.style.setProperty('--hi-color-sidebar-bg', '#1a1a2e');
            root.style.setProperty('--hi-color-overlay', 'rgba(0, 0, 0, 0.6)');

            // Code colors
            root.style.setProperty('--hi-color-code-bg', '#1e1e2e');
            root.style.setProperty('--hi-color-code-inline', '#2a2a3e');
        } else {
            // Hikari (light) theme colors
            root.style.setProperty('--hi-color-primary', '#4a9eff');
            root.style.setProperty('--hi-color-secondary', '#8b5cf6');
            root.style.setProperty('--hi-color-accent', '#f472b6');
            root.style.setProperty('--hi-color-success', '#10b981');
            root.style.setProperty('--hi-color-warning', '#f59e0b');
            root.style.setProperty('--hi-color-error', '#ef4444');
            root.style.setProperty('--hi-color-info', '#3b82f6');

            // Background colors
            root.style.setProperty('--hi-color-bg-primary', '#ffffff');
            root.style.setProperty('--hi-color-bg-secondary', '#f8fafc');
            root.style.setProperty('--hi-color-bg-tertiary', '#f1f5f9');
            root.style.setProperty('--hi-color-bg-elevated', '#ffffff');

            // Text colors
            root.style.setProperty('--hi-color-text-primary', '#1e293b');
            root.style.setProperty('--hi-color-text-secondary', '#475569');
            root.style.setProperty('--hi-color-text-tertiary', '#94a3b8');
            root.style.setProperty('--hi-color-text-disabled', '#cbd5e1');

            // Border colors
            root.style.setProperty('--hi-color-border-primary', '#e2e8f0');
            root.style.setProperty('--hi-color-border-secondary', '#f1f5f9');
            root.style.setProperty('--hi-color-border-focus', '#4a9eff');

            // Shadow
            root.style.setProperty('--hi-color-shadow', 'rgba(0, 0, 0, 0.1)');

            // Surface colors
            root.style.setProperty('--hi-color-surface-primary', '#ffffff');
            root.style.setProperty('--hi-color-surface-secondary', '#f8fafc');
            root.style.setProperty('--hi-color-surface-tertiary', '#f1f5f9');

            // Component specific
            root.style.setProperty('--hi-color-header-bg', 'rgba(255, 255, 255, 0.95)');
            root.style.setProperty('--hi-color-sidebar-bg', '#ffffff');
            root.style.setProperty('--hi-color-overlay', 'rgba(0, 0, 0, 0.4)');

            // Code colors
            root.style.setProperty('--hi-color-code-bg', '#f1f5f9');
            root.style.setProperty('--hi-color-code-inline', '#e2e8f0');
        }

        // Update theme toggle button icons
        updateThemeToggleButton(theme);

        // Update sidebar theme class
        const aside = document.getElementById('hikari-aside');
        if (aside) {
            aside.classList.remove('hi-aside-light', 'hi-aside-dark');
            aside.classList.add(theme === THEME_TAIRITSU ? 'hi-aside-dark' : 'hi-aside-light');
        }
    }

    /**
     * Update the theme toggle button icon visibility
     */
    function updateThemeToggleButton(theme) {
        const toggleBtn = document.getElementById('theme-toggle');
        if (!toggleBtn) return;

        const sunIcon = toggleBtn.querySelector('.theme-icon-sun');
        const moonIcon = toggleBtn.querySelector('.theme-icon-moon');

        if (sunIcon && moonIcon) {
            if (theme === THEME_TAIRITSU) {
                // Dark mode: show sun icon (to switch to light)
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
            } else {
                // Light mode: show moon icon (to switch to dark)
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
            }
        }
    }

    /**
     * Toggle between themes
     */
    function toggleTheme() {
        const currentTheme = getStoredTheme();
        const newTheme = currentTheme === THEME_HIKARI ? THEME_TAIRITSU : THEME_HIKARI;

        saveTheme(newTheme);
        applyTheme(newTheme);
    }

    /**
     * Initialize theme on page load
     */
    function initTheme() {
        const theme = getStoredTheme();
        applyTheme(theme);

        // Set up theme toggle button listener
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleTheme);
        }

        // Listen for storage changes (for multi-tab sync)
        window.addEventListener('storage', function(e) {
            if (e.key === THEME_STORAGE_KEY && e.newValue) {
                applyTheme(e.newValue);
            }
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }

    // Also initialize after a short delay to handle WASM hydration
    setTimeout(initTheme, 100);

    // Expose toggle function globally for potential external use
    window.hikariTheme = {
        toggle: toggleTheme,
        set: function(theme) {
            if (theme === THEME_HIKARI || theme === THEME_TAIRITSU) {
                saveTheme(theme);
                applyTheme(theme);
            }
        },
        get: getStoredTheme
    };
})();
