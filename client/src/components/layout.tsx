import BottomNavigation from './bottom-navigation';
import { useLocation } from 'wouter';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const isInChat = location === '/chat';

  return (
    <div className="h-screen bg-background font-sans flex flex-col">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
      
      {/* Bottom Navigation - hidden in chat */}
      {!isInChat && <BottomNavigation />}
    </div>
  );
}