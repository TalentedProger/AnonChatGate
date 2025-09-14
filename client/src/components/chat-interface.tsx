import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip } from 'lucide-react';

interface User {
  id: number;
  anonName: string;
}

interface Message {
  id: number;
  content: string;
  createdAt: string;
  user: User | null;
}

interface ChatInterfaceProps {
  user: User;
  messages: Message[];
  onSendMessage: (content: string) => void;
  isConnected: boolean;
  onlineCount?: number;
}

export default function ChatInterface({ 
  user, 
  messages, 
  onSendMessage, 
  isConnected,
  onlineCount = 0
}: ChatInterfaceProps) {
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    const content = messageText.trim();
    if (!content || !isConnected) return;

    onSendMessage(content);
    setMessageText('');
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const getAvatarColor = (userId: number) => {
    const colors = [
      'from-cyan-400 to-blue-500',
      'from-purple-500 to-pink-500',
      'from-emerald-400 to-cyan-500',
      'from-rose-400 to-pink-500',
      'from-indigo-500 to-purple-500',
      'from-teal-400 to-emerald-500',
    ];
    return colors[userId % colors.length];
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Connection Status Banner */}
      {!isConnected && (
        <div className="bg-destructive/20 border-b border-destructive/50 text-destructive-foreground text-center py-2 text-sm backdrop-blur-sm">
          <span className="neon-text">Соединение потеряно... Переподключение</span>
          <div className="inline-block w-4 h-4 border-2 border-destructive/50 border-t-destructive rounded-full animate-spin ml-2 neon-glow"></div>
        </div>
      )}

      {/* Chat Header */}
      <header className="glass-effect border-b neon-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mr-3 neon-glow">
            <span className="text-primary-foreground text-sm font-semibold neon-text">#</span>
          </div>
          <div>
            <h1 className="font-semibold text-card-foreground neon-text">Анонимный чат</h1>
            <p className="text-xs text-primary/80" data-testid="text-online-count">
              {onlineCount} участников онлайн
            </p>
          </div>
        </div>
        <button className="p-2 hover:bg-secondary/50 rounded-full transition-all duration-300 hover:neon-glow">
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
          </svg>
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center mx-auto mb-4 neon-border">
              <svg className="w-8 h-8 text-primary neon-glow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-primary mb-2 neon-text">
              Добро пожаловать в анонимный чат!
            </h3>
            <p className="text-accent/80 text-sm max-w-xs mx-auto">
              Общайтесь анонимно с другими участниками. Будьте взаимно вежливы.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isCurrentUser = message.user?.id === user.id;
            
            return (
              <div 
                key={`${message.id}-${message.createdAt}`}
                className={`flex items-start space-x-3 ${isCurrentUser ? 'flex-row-reverse' : ''}`}
                data-testid={`message-${message.id}`}
              >
                <div className={`w-8 h-8 bg-gradient-to-br ${
                  isCurrentUser 
                    ? 'from-primary to-accent' 
                    : getAvatarColor(message.user?.id || 0)
                } rounded-full flex items-center justify-center flex-shrink-0 ${
                  isCurrentUser ? 'neon-glow' : 'shadow-lg'
                }`}>
                  <span className="text-white text-xs font-semibold">
                    {message.user ? getInitials(message.user.anonName) : '?'}
                  </span>
                </div>
                
                <div className={`flex-1 min-w-0 ${isCurrentUser ? 'text-right' : ''}`}>
                  <div className={`flex items-baseline space-x-2 mb-1 ${isCurrentUser ? 'justify-end' : ''}`}>
                    {isCurrentUser ? (
                      <>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(message.createdAt)}
                        </span>
                        <span className="text-sm font-medium text-card-foreground">Вы</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-card-foreground">
                          {message.user?.anonName || 'Неизвестный'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(message.createdAt)}
                        </span>
                      </>
                    )}
                  </div>
                  
                  <div className={`rounded-lg px-3 py-2 ${
                    isCurrentUser 
                      ? 'bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-tr-sm neon-glow' 
                      : 'glass-effect rounded-tl-sm border border-primary/20'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="glass-effect border-t neon-border px-4 py-3">
        <div className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Введите сообщение..."
              className="w-full resize-none glass-effect border border-primary/30 rounded-2xl px-4 py-3 pr-12 text-sm text-foreground placeholder-accent/60 focus:outline-none focus:border-primary focus:neon-glow transition-all duration-300"
              rows={1}
              maxLength={1000}
              disabled={!isConnected}
              data-testid="input-message"
            />
            <button 
              className="absolute right-2 bottom-2 p-2 text-accent/60 hover:text-primary transition-all duration-300 rounded-full hover:bg-primary/20 hover:neon-glow"
              data-testid="button-attach"
            >
              <Paperclip className="w-4 h-4" />
            </button>
          </div>
          
          <button 
            onClick={handleSend}
            disabled={!messageText.trim() || !isConnected}
            className="bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-full w-12 h-12 flex items-center justify-center hover:neon-glow transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:from-muted disabled:to-muted-foreground"
            data-testid="button-send"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        
        <div className="mt-2 text-right">
          <span className="text-xs text-accent/60" data-testid="text-char-counter">
            {messageText.length}/1000
          </span>
        </div>
      </div>
    </div>
  );
}
