import BottomNavigation from './bottom-navigation';
import { useLocation } from 'wouter';
import { useEffect, useState } from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const isInChat = location === '/chat';
  const [topInset, setTopInset] = useState(0);

  useEffect(() => {
    // Detect Telegram safe area / header height
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      const safeTop = tg.safeAreaInset?.top || 0;
      const contentSafeTop = tg.contentSafeAreaInset?.top || 0;
      const totalTop = safeTop + contentSafeTop;
      if (totalTop > 0) {
        setTopInset(totalTop);
      }
    }
  }, []);

  return (
    <div className="h-screen bg-background font-sans flex flex-col">
      {/* Spacer for Telegram header/navigation buttons */}
      <div 
        className="shrink-0" 
        style={{ 
          height: topInset > 0 ? `${topInset}px` : 'var(--tg-safe-top, env(safe-area-inset-top, 0px))',
          minHeight: 'env(safe-area-inset-top, 0px)'
        }} 
      />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
      
      {/* Bottom Navigation - hidden in chat */}
      {!isInChat && <BottomNavigation />}
    </div>
  );
}