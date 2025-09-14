import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { getInitData, initializeTelegramWebApp } from '@/lib/telegram';
import { useAuth } from '@/lib/auth';
import LoadingScreen from '@/components/loading-screen';
import ChatInterface from '@/components/chat-interface';
import DevModeButton from '@/components/dev-mode-button';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: number;
  anonName: string;
  status: string;
}

interface Message {
  id: number;
  content: string;
  createdAt: string;
  user: User | null;
}

export default function ChatPage() {
  const auth = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();
  const [devMode, setDevMode] = useState(false);

  // Initialize Telegram WebApp
  useEffect(() => {
    initializeTelegramWebApp();
  }, []);

  // Authentication - use dev mode only in development
  const { data: authData, refetch: refetchAuth, isLoading: authLoading } = useQuery({
    queryKey: ['/api/auth/dev'],
    queryFn: async () => {
      // Only use dev auth in development environment
      if (!import.meta.env.DEV) {
        throw new Error('Dev authentication not available in production');
      }
      console.log('[DEBUG] Using simplified auth flow');
      const response = await apiRequest('POST', '/api/auth/dev', {});
      return await response.json();
    },
    retry: 1,
    enabled: !auth.user && import.meta.env.DEV, // Only run in dev if no user is set
  });

  // In development, create a simple user object if no auth data
  const devUser = import.meta.env.DEV && !auth.user && !authData ? {
    id: 999999,
    anonName: 'DevUser_999999',
    status: 'approved',
    createdAt: new Date().toISOString()
  } : null;

  // Update auth manager when auth data changes
  useEffect(() => {
    if (authData) {
      auth.setAuthData({
        user: authData.user,
        status: authData.status,
        token: authData.token,
        refreshToken: authData.refreshToken
      });
    }
  }, [authData]);

  // WebSocket connection
  useEffect(() => {
    const currentUser = auth.user || authData?.user || devUser;
    if (currentUser) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [auth.user, auth.token, authData, devUser]);

  const connectWebSocket = async () => {
    const currentUser = auth.user || authData?.user || devUser;
    if (!currentUser) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      
      // In development, auth can be optional
      if (import.meta.env.DEV && devUser) {
        console.log('Dev mode: Connecting without token');
        ws.send(JSON.stringify({
          type: 'auth'
        }));
      } else {
        // Production or when we have a token
        auth.getValidToken().then(token => {
          ws.send(JSON.stringify({
            type: 'auth',
            token: token
          }));
        });
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'auth_success':
            setRoomId(data.roomId);
            break;
            
          case 'auth_error':
            console.error('WebSocket auth error:', data.message);
            handleAuthError(data.message);
            break;
            
          case 'chat_history':
            setMessages(data.messages || []);
            break;
            
          case 'new_message':
            setMessages(prev => [...prev, data.message]);
            break;
            
          case 'error':
            toast({
              variant: "destructive",
              title: "Ошибка",
              description: data.message
            });
            break;
            
          default:
            console.log('Unknown WebSocket message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      
      // Reconnect after delay if still authenticated
      setTimeout(() => {
        if (auth.user && auth.token) {
          connectWebSocket();
        }
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
  };

  // Handle WebSocket auth error with token refresh
  const handleAuthError = async (message: string) => {
    console.log('WebSocket auth error:', message);
    
    // Attempt to refresh token
    const refreshSucceeded = await auth.handleAuthError();
    
    if (refreshSucceeded) {
      console.log('Token refreshed successfully, reconnecting WebSocket...');
      // Close current connection and reconnect with new token
      if (wsRef.current) {
        wsRef.current.close();
      }
      // Reconnect will happen in the onclose handler
    } else {
      // Token refresh failed, show error to user
      toast({
        variant: "destructive",
        title: "Ошибка подключения",
        description: "Токен истек. Требуется повторная аутентификация."
      });
    }
  };

  const handleSendMessage = (content: string) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({
        type: 'send_message',
        content,
        roomId
      }));
    }
  };

  const handleRefreshStatus = async () => {
    try {
      await refetchAuth();
    } catch (error) {
      console.error('Error refreshing status:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить статус"
      });
    }
  };

  // Dev mode handler for testing in browser
  const handleDevAuth = async () => {
    setDevMode(true);
    
    try {
      // Call dev auth endpoint to create/get test user
      const response = await apiRequest('POST', '/api/auth/dev');
      const data = await response.json();
      
      // Set auth data using auth manager
      auth.setAuthData({
        user: data.user,
        status: data.user.status,
        token: data.token,
        refreshToken: data.refreshToken
      });
    } catch (error) {
      console.error('Dev auth error:', error);
      toast({
        variant: "destructive",
        title: "Ошибка разработки",
        description: "Не удалось выполнить аутентификацию в режиме разработки"
      });
    }
  };

  // Show loading screen only during initial authentication in production
  if ((!import.meta.env.DEV && authLoading) || (!import.meta.env.DEV && !auth.user && !authData)) {
    return <LoadingScreen onDevAuth={handleDevAuth} message="Загрузка приложения..." />;
  }

  // Show chat interface for all users (dev mode allows without auth)
  const currentUser = auth.user || authData?.user || devUser;
  if (currentUser) {
    return (
      <ChatInterface
        user={currentUser}
        messages={messages}
        onSendMessage={handleSendMessage}
        isConnected={isConnected}
        onlineCount={messages.length > 0 ? Math.floor(Math.random() * 20) + 5 : 0}
      />
    );
  }

  // Fallback authentication error state
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Ошибка аутентификации</h2>
        <p className="text-muted-foreground mb-4">Не удалось войти в приложение</p>
        <button 
          onClick={handleRefreshStatus}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90"
        >
          Попробовать снова
        </button>
      </div>
      
      {/* Dev Mode Button */}
      <DevModeButton onDevAuth={handleDevAuth} />
    </div>
  );
}
