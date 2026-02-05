/**
 * Art Stuff - Native Capacitor Integration
 * Provides native iOS features: haptics, status bar, keyboard
 */

(function() {
    'use strict';

    // Check if running in Capacitor
    const isCapacitor = window.Capacitor !== undefined;

    if (!isCapacitor) {
        console.log('[Native] Running in browser, native features disabled');
        window.ArtStuffNative = {
            isNative: false,
            haptic: function() {},
            hapticLight: function() {},
            hapticSuccess: function() {},
            hapticWarning: function() {},
            hapticError: function() {},
        };
        return;
    }

    console.log('[Native] Running in Capacitor, initializing native features');

    // Import Capacitor plugins
    const { Haptics, ImpactStyle, NotificationFeedbackType } = window.Capacitor.Plugins.Haptics || {};
    const { StatusBar, Style } = window.Capacitor.Plugins.StatusBar || {};
    const { Keyboard } = window.Capacitor.Plugins.Keyboard || {};
    const { SplashScreen } = window.Capacitor.Plugins.SplashScreen || {};

    // Configure status bar to match app theme
    async function configureStatusBar() {
        try {
            if (StatusBar) {
                await StatusBar.setStyle({ style: Style.Dark });
                console.log('[Native] Status bar configured');
            }
        } catch (e) {
            console.warn('[Native] Status bar configuration failed:', e);
        }
    }

    // Hide splash screen when ready
    async function hideSplash() {
        try {
            if (SplashScreen) {
                await SplashScreen.hide();
                console.log('[Native] Splash screen hidden');
            }
        } catch (e) {
            console.warn('[Native] Splash screen hide failed:', e);
        }
    }

    // Haptic feedback functions
    const haptics = {
        // Medium impact - for button taps, selections
        impact: async function() {
            try {
                if (Haptics) {
                    await Haptics.impact({ style: ImpactStyle.Medium });
                }
            } catch (e) {}
        },

        // Light impact - for subtle feedback
        light: async function() {
            try {
                if (Haptics) {
                    await Haptics.impact({ style: ImpactStyle.Light });
                }
            } catch (e) {}
        },

        // Heavy impact - for significant actions
        heavy: async function() {
            try {
                if (Haptics) {
                    await Haptics.impact({ style: ImpactStyle.Heavy });
                }
            } catch (e) {}
        },

        // Success notification
        success: async function() {
            try {
                if (Haptics) {
                    await Haptics.notification({ type: NotificationFeedbackType.Success });
                }
            } catch (e) {}
        },

        // Warning notification
        warning: async function() {
            try {
                if (Haptics) {
                    await Haptics.notification({ type: NotificationFeedbackType.Warning });
                }
            } catch (e) {}
        },

        // Error notification
        error: async function() {
            try {
                if (Haptics) {
                    await Haptics.notification({ type: NotificationFeedbackType.Error });
                }
            } catch (e) {}
        }
    };

    // Keyboard handling for iOS
    function setupKeyboard() {
        if (!Keyboard) return;

        try {
            Keyboard.addListener('keyboardWillShow', (info) => {
                document.body.classList.add('keyboard-open');
                document.body.style.setProperty('--keyboard-height', info.keyboardHeight + 'px');
            });

            Keyboard.addListener('keyboardWillHide', () => {
                document.body.classList.remove('keyboard-open');
                document.body.style.setProperty('--keyboard-height', '0px');
            });

            console.log('[Native] Keyboard listeners configured');
        } catch (e) {
            console.warn('[Native] Keyboard setup failed:', e);
        }
    }

    // Initialize everything
    async function init() {
        await configureStatusBar();
        setupKeyboard();

        // Hide splash after a short delay to ensure content is ready
        setTimeout(hideSplash, 500);

        console.log('[Native] Initialization complete');
    }

    // Expose API globally
    window.ArtStuffNative = {
        isNative: true,
        init: init,
        haptic: haptics.impact,
        hapticLight: haptics.light,
        hapticHeavy: haptics.heavy,
        hapticSuccess: haptics.success,
        hapticWarning: haptics.warning,
        hapticError: haptics.error
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
