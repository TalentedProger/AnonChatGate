import { useState, useEffect } from 'react';

/**
 * Hook to get the appropriate top padding for Telegram Mini App
 * Returns the total safe area (header + notch) or 56px fallback when in Telegram
 */
export function useTelegramPadding() {
  const [topPadding, setTopPadding] = useState(0);
  const [bottomPadding, setBottomPadding] = useState(0);
  const [isInTelegram, setIsInTelegram] = useState(false);

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    
    const updatePadding = () => {
      if (tg) {
        setIsInTelegram(true);
        
        // Telegram Mini Apps have safeAreaInset (for notches) and contentSafeAreaInset (for Telegram header)
        const safeTop = tg.safeAreaInset?.top || 0;
        const contentSafeTop = tg.contentSafeAreaInset?.top || 0;
        const totalTop = safeTop + contentSafeTop;
        
        const safeBottom = tg.safeAreaInset?.bottom || 0;
        const contentSafeBottom = tg.contentSafeAreaInset?.bottom || 0;
        const totalBottom = safeBottom + contentSafeBottom;
        
        // Use detected value or fallback to reasonable minimum (56px for Telegram header)
        setTopPadding(totalTop > 0 ? totalTop : 56);
        setBottomPadding(totalBottom);
      } else {
        setIsInTelegram(false);
        setTopPadding(0);
        setBottomPadding(0);
      }
    };
    
    updatePadding();
    
    // Listen for safe area changes
    if (tg) {
      tg.onEvent?.('safeAreaChanged', updatePadding);
      tg.onEvent?.('contentSafeAreaChanged', updatePadding);
      tg.onEvent?.('viewportChanged', updatePadding);
    }
    
    return () => {
      if (tg) {
        tg.offEvent?.('safeAreaChanged', updatePadding);
        tg.offEvent?.('contentSafeAreaChanged', updatePadding);
        tg.offEvent?.('viewportChanged', updatePadding);
      }
    };
  }, []);

  return { topPadding, bottomPadding, isInTelegram };
}
