import BottomNavigation from './bottom-navigation';
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const isInChat = location === '/chat';
  const [topPadding, setTopPadding] = useState(0);

  useEffect(() => {
    // Detect Telegram safe area / header height
    const tg = (window as any).Telegram?.WebApp;
    
    const updatePadding = () => {
      if (tg) {
        // Telegram Mini Apps have safeAreaInset (for notches) and contentSafeAreaInset (for Telegram header)
        const safeTop = tg.safeAreaInset?.top || 0;
        const contentSafeTop = tg.contentSafeAreaInset?.top || 0;
        const totalTop = safeTop + contentSafeTop;
        
        // Use detected value or fallback to reasonable minimum (56px for Telegram header)
        setTopPadding(totalTop > 0 ? totalTop : 56);
      } else {
        // Not in Telegram - no padding needed
        setTopPadding(0);
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

  return (
    <div className="h-screen font-sans flex flex-col">
      {/* Spacer for Telegram header/navigation buttons - transparent so page bg shows through */}
      {topPadding > 0 && (
        <div 
          className="shrink-0" 
          style={{ height: `${topPadding}px` }} 
        />
      )}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
      
      {/* Bottom Navigation - hidden in chat */}
      {!isInChat && <BottomNavigation />}
    </div>
  );
}