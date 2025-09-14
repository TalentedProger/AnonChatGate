import { useLocation } from 'wouter';
import { Home, MessageCircle, User } from 'lucide-react';
import { Link } from 'wouter';

const navigationItems = [
  {
    id: 'home',
    label: 'Главная',
    icon: Home,
    path: '/'
  },
  {
    id: 'chats', 
    label: 'Чаты',
    icon: MessageCircle,
    path: '/chats'
  },
  {
    id: 'profile',
    label: 'Профиль', 
    icon: User,
    path: '/profile'
  }
];

export default function BottomNavigation() {
  const [location] = useLocation();
  
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="flex items-center justify-around h-16 px-4">
        {navigationItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.id}
              href={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors ${
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid={`nav-${item.id}`}
            >
              <Icon size={20} className="mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}