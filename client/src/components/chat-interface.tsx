import { useState, useEffect, useRef, memo } from 'react';
import { Send, ChevronLeft, Check, CheckCheck, Menu } from 'lucide-react';
import { useLocation } from 'wouter';
import chatBackgroundGalaxy from '@/assets/chat_background_galaxy.jpg';
import mainGroupInternal from '@/assets/main_group_internal.jpg';
import type { ChatUser, ChatMessage } from '@/types';

interface ChatInterfaceProps {
  user: ChatUser;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  onInputChange?: () => void;
  onLoadMore?: () => void;
  hasMoreMessages?: boolean;
  isLoadingMore?: boolean;
  isConnected: boolean;
  totalUsers?: number;
  onlineCount?: number;
  typingUsers?: number[];
}

export default function ChatInterface({ 
  user, 
  messages, 
  onSendMessage,
  onInputChange,
  onLoadMore,
  hasMoreMessages = false,
  isLoadingMore = false,
  isConnected,
  totalUsers = 0,
  onlineCount = 0,
  typingUsers = []
}: ChatInterfaceProps) {
  const [, setLocation] = useLocation();
  const [messageText, setMessageText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [useBackgroundImage, setUseBackgroundImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Navigate to user profile
  const handleUserClick = (userId: number) => {
    // Don't navigate to own profile from chat
    if (userId === user.id) return;
    setLocation(`/user/${userId}`);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

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

    // Notify parent component of typing
    if (onInputChange) {
      onInputChange();
    }
  };

  const getAvatarColor = (userId: number) => {
    const colors = [
      'bg-cyan-600',
      'bg-purple-600',
      'bg-emerald-600',
      'bg-rose-600',
      'bg-indigo-600',
      'bg-teal-600',
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
    <div className="h-full flex flex-col bg-black">

      {/* Chat Header */}
      <header className="bg-black border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <button 
            onClick={() => window.history.back()}
            className="p-2 mr-2 hover:bg-zinc-800 rounded-full transition-colors"
            data-testid="button-back"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="w-8 h-8 rounded-full overflow-hidden mr-3 ring-1 ring-white">
            <img 
              src={mainGroupInternal} 
              alt="Group Internal" 
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <div>
            <h1 className="font-semibold text-white">Анонимный чат</h1>
            <p className="text-xs text-zinc-200" data-testid="text-online-count">
              <span className="text-blue-400 font-medium">{totalUsers}</span> <span className="text-zinc-200">участников</span> | <span className="text-green-400 font-medium">{onlineCount}</span> <span className="text-zinc-200">онлайн</span>
            </p>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
          >
            <Menu className="w-5 h-5 text-zinc-400" />
          </button>
          
          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute right-0 top-12 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-56 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <button
                onClick={() => {
                  setUseBackgroundImage(!useBackgroundImage);
                  setMenuOpen(false);
                }}
                className="w-full px-4 py-3 text-left text-white hover:bg-zinc-800 transition-colors rounded-lg flex items-center justify-between"
              >
                <span>{useBackgroundImage ? 'Темный фон' : 'Фоновое изображение'}</span>
                <div className={`w-4 h-4 rounded-sm border-2 ${useBackgroundImage ? 'bg-purple-600 border-purple-600' : 'border-zinc-500'}`}></div>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scroll-smooth relative"
        style={{
          background: useBackgroundImage 
            ? `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(${chatBackgroundGalaxy}) center/cover fixed` 
            : '#000'
        }}
      >
        <div className="relative z-10">
        {/* Load More Button */}
        {hasMoreMessages && (
          <div className="flex justify-center py-4">
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-500 text-white text-sm rounded-full transition-colors flex items-center gap-2"
            >
              {isLoadingMore ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Загрузка...
                </>
              ) : (
                '↑ Загрузить ещё'
              )}
            </button>
          </div>
        )}
        
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Добро пожаловать в анонимный чат!
            </h3>
            <p className="text-zinc-400 text-sm max-w-xs mx-auto">
              Общайтесь анонимно с другими участниками. Будьте взаимно вежливы.
            </p>
          </div>
        ) : (
          messages.map((message) => {
            const isCurrentUser = message.user?.id === user.id;
            
            return (
              <div 
                key={`${message.id}-${message.createdAt}`}
                className="flex items-start space-x-3"
                data-testid={`message-${message.id}`}
              >
                {/* Clickable Avatar */}
                <button
                  onClick={() => message.user && !isCurrentUser && handleUserClick(message.user.id)}
                  disabled={isCurrentUser || !message.user}
                  className={`w-8 h-8 ${
                    getAvatarColor(message.user?.id || 0)
                  } rounded-full flex items-center justify-center flex-shrink-0 ${
                    !isCurrentUser && message.user ? 'cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all' : ''
                  }`}
                >
                  <span className="text-white text-xs font-semibold">
                    {message.user ? getInitials(message.user.anonName) : '?'}
                  </span>
                </button>
                
                <div className="flex-1 min-w-0 max-w-[70%]">
                  <div className="flex items-baseline space-x-2 mb-2">
                    {/* Clickable Username */}
                    <button
                      onClick={() => message.user && !isCurrentUser && handleUserClick(message.user.id)}
                      disabled={isCurrentUser || !message.user}
                      className={`text-sm font-medium text-white drop-shadow-lg ${
                        !isCurrentUser && message.user ? 'cursor-pointer hover:text-purple-400 transition-colors' : ''
                      }`}
                    >
                      {isCurrentUser ? 'Вы' : (message.user?.anonName || 'Неизвестный')}
                    </button>
                    <span className="text-xs text-zinc-400 drop-shadow-md">
                      {formatTime(message.createdAt)}
                    </span>
                    {/* Read receipts - show only for current user's messages, next to time */}
                    {isCurrentUser && (
                      <>
                        {message.readBy && message.readBy.length > 0 ? (
                          <div className="flex items-center text-blue-400">
                            <CheckCheck className="w-3 h-3" />
                          </div>
                        ) : message.deliveredTo && message.deliveredTo.length > 0 ? (
                          <div className="flex items-center text-zinc-400">
                            <CheckCheck className="w-3 h-3" />
                          </div>
                        ) : (
                          <div className="flex items-center text-zinc-500">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div className={`rounded-lg px-3 py-2 mb-3 ${
                    isCurrentUser 
                      ? 'bg-blue-600/95 text-white rounded-tl-sm backdrop-blur-sm' 
                      : 'bg-zinc-800/95 border border-zinc-700 rounded-tl-sm text-white backdrop-blur-sm'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        
        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-2 text-zinc-400 text-sm animate-pulse">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <span>
              {typingUsers.length === 1 ? 'Кто-то печатает' : `${typingUsers.length} человек(а) печатают`}...
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="bg-black border-t border-zinc-800 px-4 py-3">
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Введите сообщение..."
              className="w-full resize-none bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors"
              rows={1}
              maxLength={1000}
              disabled={!isConnected}
              data-testid="input-message"
            />
          </div>
          
          <button 
            onClick={handleSend}
            disabled={!messageText.trim() || !isConnected}
            className="bg-purple-600 text-white rounded-full w-10 h-10 flex items-center justify-center hover:bg-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-zinc-700 flex-shrink-0"
            data-testid="button-send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        
        <div className="mt-2 text-right">
          <span className="text-xs text-zinc-500" data-testid="text-char-counter">
            {messageText.length}/1000
          </span>
        </div>
      </div>
    </div>
  );
}
