import { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { Send, ChevronLeft, Check, CheckCheck, Menu, Reply, X, Copy } from 'lucide-react';
import { useLocation } from 'wouter';
import chatBackgroundGalaxy from '@/assets/chat_background_galaxy.jpg';
import mainGroupInternal from '@/assets/main_group_internal.jpg';
import type { ChatUser, ChatMessage } from '@/types';

// Reply data stored as JSON at start of message
interface ReplyData {
  id: number;
  anonName: string;
  content: string;
}

// Parse reply from message content - checks if message starts with JSON reply format
function parseReplyFromContent(content: string): { replyTo: ReplyData | null; actualContent: string } {
  // Check for JSON reply format: [REPLY:{"id":1,"anonName":"User","content":"text"}]
  const replyRegex = /^\[REPLY:(.*?)\]\n?/;
  const match = content.match(replyRegex);
  
  if (match) {
    try {
      const replyData = JSON.parse(match[1]) as ReplyData;
      return {
        replyTo: replyData,
        actualContent: content.replace(replyRegex, '').trim()
      };
    } catch {
      // Invalid JSON, treat as normal message
    }
  }
  
  // Fallback: Check for old text format and parse it
  const oldReplyRegex = /^↩️\s*@([^:]+):\s*[""]([^""]+)[""]\s*\n\n/;
  const oldMatch = content.match(oldReplyRegex);
  if (oldMatch) {
    return {
      replyTo: {
        id: 0,
        anonName: oldMatch[1].trim(),
        content: oldMatch[2].trim()
      },
      actualContent: content.replace(oldReplyRegex, '').trim()
    };
  }
  
  // Check for &quot; escaped format
  const escapedReplyRegex = /^↩️\s*@([^:]+):\s*&quot;([^&]+)&quot;\s*\n\n/;
  const escapedMatch = content.match(escapedReplyRegex);
  if (escapedMatch) {
    return {
      replyTo: {
        id: 0,
        anonName: escapedMatch[1].trim(),
        content: escapedMatch[2].trim()
      },
      actualContent: content.replace(escapedReplyRegex, '').trim()
    };
  }
  
  return { replyTo: null, actualContent: content };
}

// Format date for date separator
function formatDateSeparator(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const yesterdayOnly = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  
  if (dateOnly.getTime() === todayOnly.getTime()) {
    return 'Сегодня';
  } else if (dateOnly.getTime() === yesterdayOnly.getTime()) {
    return 'Вчера';
  } else {
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 
                    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  }
}

// Get date key for grouping messages
function getDateKey(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

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
  // Load chat background preference from localStorage
  const [useBackgroundImage, setUseBackgroundImage] = useState(() => {
    const saved = localStorage.getItem('chatBackgroundImage');
    return saved === 'true';
  });
  
  // Cache participant counts to prevent flickering when WebSocket reconnects
  const [cachedTotalUsers, setCachedTotalUsers] = useState(() => {
    const saved = localStorage.getItem('chatCachedTotalUsers');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [cachedOnlineCount, setCachedOnlineCount] = useState(() => {
    const saved = localStorage.getItem('chatCachedOnlineCount');
    return saved ? parseInt(saved, 10) : 0;
  });
  
  // Update cached values only when we have valid non-zero data
  useEffect(() => {
    if (totalUsers > 0) {
      setCachedTotalUsers(totalUsers);
      localStorage.setItem('chatCachedTotalUsers', String(totalUsers));
    }
    if (onlineCount > 0) {
      setCachedOnlineCount(onlineCount);
      localStorage.setItem('chatCachedOnlineCount', String(onlineCount));
    }
  }, [totalUsers, onlineCount]);
  
  // Use the best available count (live or cached)
  const displayTotalUsers = totalUsers > 0 ? totalUsers : cachedTotalUsers;
  const displayOnlineCount = onlineCount > 0 ? onlineCount : cachedOnlineCount;
  
  // Reply functionality state
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [contextMenuMessage, setContextMenuMessage] = useState<ChatMessage | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  
  // Touch/swipe state for reply with animation
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const swipingMessageId = useRef<number | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<{ [key: number]: number }>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Handle reply to message
  const handleReply = useCallback((message: ChatMessage) => {
    setReplyingTo(message);
    setContextMenuMessage(null);
    // Vibrate on reply trigger (like Telegram)
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    textareaRef.current?.focus();
  }, []);
  
  // Cancel reply
  const cancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);
  
  // Copy message to clipboard
  const handleCopyMessage = useCallback((message: ChatMessage) => {
    const { actualContent } = parseReplyFromContent(message.content);
    navigator.clipboard.writeText(actualContent);
    setContextMenuMessage(null);
    // Vibrate feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);
  
  // Touch handlers for swipe-to-reply with animation
  const handleTouchStart = useCallback((e: React.TouchEvent, message: ChatMessage) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    swipingMessageId.current = message.id;
    
    // Long press timer for context menu - get message element position
    longPressTimer.current = setTimeout(() => {
      // Find the message bubble element
      const target = e.target as HTMLElement;
      const messageBubble = target.closest('[data-message-bubble]');
      if (messageBubble) {
        const rect = messageBubble.getBoundingClientRect();
        setContextMenuPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
      } else {
        const rect = target.getBoundingClientRect();
        setContextMenuPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
      }
      setContextMenuMessage(message);
      swipingMessageId.current = null;
      setSwipeOffset(prev => ({ ...prev, [message.id]: 0 }));
      // Vibrate on context menu open
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    }, 500);
  }, []);
  
  const handleTouchMove = useCallback((e: React.TouchEvent, message: ChatMessage) => {
    // Cancel long press if moving
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    touchCurrentX.current = e.touches[0].clientX;
    
    // Calculate swipe offset for animation (only allow left swipe)
    if (swipingMessageId.current === message.id) {
      const deltaX = touchStartX.current - touchCurrentX.current;
      // Limit swipe to 80px max, only positive (left) direction
      const offset = Math.min(Math.max(deltaX, 0), 80);
      setSwipeOffset(prev => ({ ...prev, [message.id]: offset }));
    }
  }, []);
  
  const handleTouchEnd = useCallback((message: ChatMessage) => {
    // Cancel long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    const deltaX = touchStartX.current - touchCurrentX.current;
    
    // Swipe left threshold (50px) to trigger reply
    if (deltaX > 50 && swipingMessageId.current === message.id) {
      handleReply(message);
    }
    
    // Reset swipe animation
    setSwipeOffset(prev => ({ ...prev, [message.id]: 0 }));
    
    swipingMessageId.current = null;
    touchStartX.current = 0;
    touchCurrentX.current = 0;
  }, [handleReply]);
  
  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenuMessage(null);
    };
    
    if (contextMenuMessage) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenuMessage]);

  // Save background preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('chatBackgroundImage', String(useBackgroundImage));
  }, [useBackgroundImage]);

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

    // If replying, prepend reply data as JSON
    if (replyingTo) {
      const replyData: ReplyData = {
        id: replyingTo.id,
        anonName: replyingTo.user?.anonName || 'Неизвестный',
        content: replyingTo.content.substring(0, 100)
      };
      onSendMessage(`[REPLY:${JSON.stringify(replyData)}]\n${content}`);
      setReplyingTo(null);
    } else {
      onSendMessage(content);
    }
    
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
              <span className="text-blue-400 font-medium">{displayTotalUsers}</span> <span className="text-zinc-200">участников</span> | <span className="text-green-400 font-medium">{displayOnlineCount}</span> <span className="text-zinc-200">онлайн</span>
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
          messages.map((message, index) => {
            const isCurrentUser = message.user?.id === user.id;
            const currentOffset = swipeOffset[message.id] || 0;
            
            // Parse reply from message content
            const { replyTo, actualContent } = parseReplyFromContent(message.content);
            
            // Check if we need to show date separator
            const currentDateKey = getDateKey(message.createdAt);
            const previousMessage = index > 0 ? messages[index - 1] : null;
            const previousDateKey = previousMessage ? getDateKey(previousMessage.createdAt) : null;
            const showDateSeparator = currentDateKey !== previousDateKey;
            
            return (
              <div key={`${message.id}-${message.createdAt}`}>
                {/* Date Separator */}
                {showDateSeparator && (
                  <div className="flex justify-center my-4">
                    <div className="bg-zinc-800/90 backdrop-blur-sm text-zinc-300 text-xs font-medium px-3 py-1.5 rounded-full shadow-lg">
                      {formatDateSeparator(message.createdAt)}
                    </div>
                  </div>
                )}
                
                <div 
                  className="flex items-start space-x-3 group relative overflow-hidden"
                  data-testid={`message-${message.id}`}
                  onTouchStart={(e) => handleTouchStart(e, message)}
                  onTouchMove={(e) => handleTouchMove(e, message)}
                  onTouchEnd={() => handleTouchEnd(message)}
                >
                  {/* Reply indicator that appears during swipe */}
                  <div 
                    className="absolute left-0 top-1/2 -translate-y-1/2 flex items-center justify-center transition-opacity duration-150"
                    style={{ 
                      opacity: currentOffset > 20 ? Math.min((currentOffset - 20) / 30, 1) : 0,
                      transform: `translateX(${Math.max(0, currentOffset - 60)}px)`
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-violet-500/80 flex items-center justify-center">
                      <Reply className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  
                  {/* Message container with swipe animation */}
                  <div 
                    className="flex items-start space-x-3 w-full transition-transform"
                    style={{ 
                      transform: `translateX(-${currentOffset}px)`,
                      transition: currentOffset === 0 ? 'transform 0.2s ease-out' : 'none'
                    }}
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
                        {/* Reply button - appears on hover (desktop) */}
                        <button
                          onClick={() => handleReply(message)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-zinc-700 rounded"
                          title="Ответить"
                        >
                          <Reply className="w-3 h-3 text-zinc-400" />
                        </button>
                      </div>
                      
                      <div 
                        data-message-bubble
                        className={`rounded-lg px-3 py-2 mb-3 select-none ${
                          isCurrentUser 
                            ? 'bg-blue-600/95 text-white rounded-tl-sm backdrop-blur-sm' 
                            : 'bg-zinc-800/95 border border-zinc-700 rounded-tl-sm text-white backdrop-blur-sm'
                        }`}
                      >
                        {/* Reply Preview - shown inside message if this is a reply */}
                        {replyTo && (
                          <div className={`mb-2 pl-2 border-l-2 ${isCurrentUser ? 'border-blue-300' : 'border-violet-500'}`}>
                            <p className={`text-xs font-medium ${isCurrentUser ? 'text-blue-200' : 'text-violet-400'}`}>
                              {replyTo.anonName}
                            </p>
                            <p className={`text-xs ${isCurrentUser ? 'text-blue-100/70' : 'text-zinc-400'} line-clamp-1`}>
                              {replyTo.content}
                            </p>
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words select-none">{actualContent}</p>
                      </div>
                    </div>
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
        
        {/* Context Menu Overlay with Blur */}
        {contextMenuMessage && (
          <div 
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setContextMenuMessage(null)}
          />
        )}
        
        {/* Context Menu for Long Press */}
        {contextMenuMessage && (
          <div 
            className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 min-w-[160px]"
            style={{ 
              left: Math.min(Math.max(contextMenuPosition.x - 80, 16), window.innerWidth - 176), 
              top: Math.min(contextMenuPosition.y, window.innerHeight - 120)
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => handleReply(contextMenuMessage)}
              className="flex items-center gap-3 px-4 py-3 w-full hover:bg-zinc-700 transition-colors text-white border-b border-zinc-700"
            >
              <Reply className="w-5 h-5 text-violet-400" />
              <span className="text-sm font-medium">Ответить</span>
            </button>
            <button
              onClick={() => handleCopyMessage(contextMenuMessage)}
              className="flex items-center gap-3 px-4 py-3 w-full hover:bg-zinc-700 transition-colors text-white"
            >
              <Copy className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-medium">Копировать</span>
            </button>
          </div>
        )}
      </div>

      {/* Reply Preview */}
      {replyingTo && (
        <div className="bg-zinc-900 border-t border-zinc-800 px-4 py-2 flex items-center gap-3">
          <div className="w-1 h-10 bg-violet-500 rounded-full"></div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-violet-400 font-medium">
              Ответ для {replyingTo.user?.anonName || 'Неизвестный'}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {replyingTo.content}
            </p>
          </div>
          <button 
            onClick={cancelReply}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* Message Input */}
      <div className="bg-black border-t border-zinc-800 px-4 py-3">
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={replyingTo ? "Введите ответ..." : "Введите сообщение..."}
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
