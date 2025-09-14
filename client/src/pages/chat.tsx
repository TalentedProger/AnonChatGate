import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { getInitData, initializeTelegramWebApp } from '@/lib/telegram';
import { useAuth } from '@/lib/auth';
import ChatInterface from '@/components/chat-interface';
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

  // Simple auth - always create a basic user
  const simpleUser = {
    id: 999999,
    anonName: 'Student_999999',
    status: 'approved',
    createdAt: new Date().toISOString()
  };

  // Set simple user to auth if no user exists
  useEffect(() => {
    if (!auth.user) {
      auth.setAuthData({
        user: simpleUser,
        status: 'approved',
        token: 'dev_token',
        refreshToken: 'dev_refresh_token'
      });
    }
  }, []);

  // WebSocket connection
  useEffect(() => {
    const currentUser = auth.user || simpleUser;
    if (currentUser) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [auth.user]);

  const connectWebSocket = async () => {
    const currentUser = auth.user || simpleUser;
    if (!currentUser) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      
      // Simple auth without token requirement
      ws.send(JSON.stringify({
        type: 'auth'
      }));
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
            // Ignore auth errors in simplified mode
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


  const handleSendMessage = (content: string) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({
        type: 'send_message',
        content,
        roomId
      }));
    }
  };


  // Always show chat interface with simple user
  const currentUser = auth.user || simpleUser;
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
