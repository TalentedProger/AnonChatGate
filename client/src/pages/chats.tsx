import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import mainGroupImage from '@/assets/main_group_image.jpg';

export default function ChatsPage() {
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
                      Участников: <span className="text-green-400 font-medium">24</span> • 
                      Онлайн: <span className="text-blue-400 font-medium">8</span>
                    </p>
                    <p className="text-sm text-zinc-300 truncate" data-testid="text-last-message">
                      Привет всем! Как дела с учёбой?
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