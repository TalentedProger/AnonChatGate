import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import mainGroupImage from '@/assets/main_group_image.jpg';

interface ChatStatistics {
  totalUsers: number;
  onlineUsers: number;
}

interface LastMessage {
  id: number;
  content: string;
  createdAt: string;
  anonName: string | null;
}

export default function ChatsPage() {
  // Use React Query for optimized caching and automatic refetch
  const { data: statistics, isLoading: statsLoading } = useQuery({
    queryKey: ['chat-statistics', 1],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/statistics/chat/1');
      if (!response.ok) throw new Error('Failed to load statistics');
      const data = await response.json();
      return {
        totalUsers: data.totalUsers || 0,
        onlineUsers: data.onlineUsers || 0
      };
    },
    staleTime: 5000, // Cache for 5 seconds (more frequent updates for online count)
    refetchInterval: 10000, // Auto-refresh every 10 seconds for online status
    refetchOnWindowFocus: true,
    refetchOnMount: true
  });

  const { data: lastMessage, isLoading: messageLoading } = useQuery({
    queryKey: ['last-message', 1],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/statistics/last-message/1');
      if (!response.ok) throw new Error('Failed to load last message');
      const data = await response.json();
      return data.lastMessage;
    },
    staleTime: 10000, // Cache for 10 seconds
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true
  });

  const loading = statsLoading || messageLoading;

  return (
    <div className="h-full bg-black text-white overflow-y-auto">
      {/* Header */}
      <div className="bg-black border-b border-zinc-800 px-4 py-6">
        <h1 className="text-xl font-semibold text-white">AguGram</h1>
      </div>

      {/* Chat List */}
      <div className="p-4">
        <Link href="/chat" data-testid="link-anonymous-chat">
          <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 hover:bg-zinc-800 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full overflow-hidden">
                  <img 
                    src={mainGroupImage} 
                    alt="Main Group" 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-medium text-white" data-testid="text-chat-name">
                    Анонимный чат
                  </h3>
                  <div className="space-y-1">
                    <p className="text-xs text-zinc-500" data-testid="text-chat-participants">
                      Участников: <span className="text-green-400 font-medium">{statistics?.totalUsers || 0}</span> • 
                      Онлайн: <span className="text-blue-400 font-medium">{statistics?.onlineUsers || 0}</span>
                    </p>
                    <p className="text-sm text-zinc-300 truncate max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap" data-testid="text-last-message">
                      {loading ? (
                        <span className="text-zinc-500">Загрузка...</span>
                      ) : lastMessage ? (
                        <>{lastMessage.anonName ? `${lastMessage.anonName}: ` : ''}{lastMessage.content.replace(/&quot;/g, '"')}</>
                      ) : (
                        <span className="text-zinc-500">Нет сообщений</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-zinc-400" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}