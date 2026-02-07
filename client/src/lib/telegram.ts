declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: any;
        ready(): void;
        expand(): void;
        close(): void;
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        isClosingConfirmationEnabled: boolean;
        enableClosingConfirmation(): void;
        disableClosingConfirmation(): void;
        setHeaderColor(color: string): void;
        setBackgroundColor(color: string): void;
        requestFullscreen?(): Promise<void>;
        exitFullscreen?(): Promise<void>;
        isFullscreen?: boolean;
        lockOrientation?(): void;
        unlockOrientation?(): void;
        disableVerticalSwipes?(): void;
        enableVerticalSwipes?(): void;
        isVerticalSwipesEnabled?: boolean;
        onEvent(eventType: string, callback: () => void): void;
        offEvent(eventType: string, callback: () => void): void;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          show(): void;
          hide(): void;
          enable(): void;
          disable(): void;
          showProgress(leaveActive?: boolean): void;
          hideProgress(): void;
          onClick(callback: () => void): void;
          offClick(callback: () => void): void;
          setText(text: string): void;
          setParams(params: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }): void;
        };
        BackButton: {
          isVisible: boolean;
          show(): void;
          hide(): void;
          onClick(callback: () => void): void;
          offClick(callback: () => void): void;
        };
        SettingsButton?: {
          isVisible: boolean;
          show(): void;
          hide(): void;
          onClick(callback: () => void): void;
          offClick(callback: () => void): void;
        };
        HapticFeedback: {
          impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
          notificationOccurred(type: 'error' | 'success' | 'warning'): void;
          selectionChanged(): void;
        };
        platform: string;
        version: string;
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
      };
    };
  }
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: any;
  ready(): void;
  expand(): void;
  close(): void;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  platform: string;
  version: string;
  colorScheme: 'light' | 'dark';
  requestFullscreen?(): Promise<void>;
  exitFullscreen?(): Promise<void>;
  isFullscreen?: boolean;
  disableVerticalSwipes?(): void;
  enableVerticalSwipes?(): void;
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp as TelegramWebApp;
  }
  return null;
}

export function getInitData(): string | null {
  const webApp = getTelegramWebApp();
  if (webApp && webApp.initData) {
    return webApp.initData;
  }
  
  // Fallback for development
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    return params.get('initData');
  }
  
  return null;
}

/**
 * Initialize Telegram WebApp with full-screen mode and optimal settings
 * This should be called as early as possible in the app lifecycle
 */
export function initializeTelegramWebApp(): boolean {
  const webApp = window.Telegram?.WebApp;
  
  if (!webApp) {
    console.log('[Telegram] WebApp not available - running outside Telegram');
    return false;
  }
  
  try {
    // Get version number for feature detection
    const version = webApp.version ? parseFloat(webApp.version) : 6.0;
    
    // 1. Signal that the app is ready
    webApp.ready();
    
    // 2. Expand the app to full height
    webApp.expand();
    
    // 3. Set dark theme colors to match our app (requires version 6.1+)
    if (version >= 6.1) {
      try {
        webApp.setHeaderColor('#000000');
        webApp.setBackgroundColor('#000000');
      } catch (e) {
        console.log('[Telegram] Theme colors not supported');
      }
    }
    
    // 4. Disable vertical swipes to prevent accidental closing (requires version 7.7+)
    if (version >= 7.7 && typeof webApp.disableVerticalSwipes === 'function') {
      try {
        webApp.disableVerticalSwipes();
      } catch (e) {
        console.log('[Telegram] Vertical swipes control not supported');
      }
    }
    
    // 5. Request fullscreen mode if available (Telegram Bot API 8.0+)
    if (version >= 8.0 && typeof webApp.requestFullscreen === 'function') {
      webApp.requestFullscreen().catch((err) => {
        console.log('[Telegram] Fullscreen not available:', err);
      });
    }
    
    // 6. Enable closing confirmation to prevent accidental closing (requires version 6.2+)
    if (version >= 6.2 && typeof webApp.enableClosingConfirmation === 'function') {
      try {
        webApp.enableClosingConfirmation();
      } catch (e) {
        console.log('[Telegram] Closing confirmation not supported');
      }
    }
    
    // 7. Handle viewport changes
    webApp.onEvent('viewportChanged', () => {
      // Re-expand if viewport changed and not expanded
      if (!webApp.isExpanded) {
        webApp.expand();
      }
      
      // Update CSS custom property for viewport height
      document.documentElement.style.setProperty(
        '--tg-viewport-height', 
        `${webApp.viewportStableHeight}px`
      );
    });
    
    // 8. Set initial viewport height CSS variable
    document.documentElement.style.setProperty(
      '--tg-viewport-height', 
      `${webApp.viewportStableHeight || window.innerHeight}px`
    );
    
    // 9. Apply full viewport height to html and body
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
    
    console.log('[Telegram] WebApp initialized:', {
      platform: webApp.platform,
      version: webApp.version,
      isExpanded: webApp.isExpanded,
      viewportHeight: webApp.viewportHeight,
      viewportStableHeight: webApp.viewportStableHeight,
      colorScheme: webApp.colorScheme,
      isFullscreen: webApp.isFullscreen
    });
    
    return true;
  } catch (error) {
    console.error('[Telegram] Failed to initialize WebApp:', error);
    return false;
  }
}

/**
 * Check if running inside Telegram WebApp
 */
export function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && !!window.Telegram?.WebApp?.initData;
}

/**
 * Get the stable viewport height for layouts
 */
export function getViewportHeight(): number {
  const webApp = window.Telegram?.WebApp;
  if (webApp?.viewportStableHeight) {
    return webApp.viewportStableHeight;
  }
  return window.innerHeight;
}

/**
 * Trigger haptic feedback
 */
export function hapticFeedback(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection'): void {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.HapticFeedback) return;
  
  switch (type) {
    case 'light':
    case 'medium':
    case 'heavy':
      webApp.HapticFeedback.impactOccurred(type);
      break;
    case 'success':
    case 'error':
    case 'warning':
      webApp.HapticFeedback.notificationOccurred(type);
      break;
    case 'selection':
      webApp.HapticFeedback.selectionChanged();
      break;
  }
}

/**
 * Show the back button and set up handler
 */
export function showBackButton(callback: () => void): () => void {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.BackButton) return () => {};
  
  webApp.BackButton.onClick(callback);
  webApp.BackButton.show();
  
  return () => {
    webApp.BackButton.offClick(callback);
    webApp.BackButton.hide();
  };
}

/**
 * Close the WebApp
 */
export function closeWebApp(): void {
  const webApp = window.Telegram?.WebApp;
  if (webApp) {
    webApp.close();
  }
}

