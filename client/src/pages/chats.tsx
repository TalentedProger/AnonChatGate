import { Link } from 'wouter';
import { MessageSquare, ArrowRight } from 'lucide-react';

export default function ChatsPage() {
  return (
    <div className="h-full bg-black text-white">
      {/* Header */}
      <div className="bg-black border-b border-zinc-800 px-4 py-6">
        <h1 className="text-xl font-semibold text-white">Чаты</h1>
      </div>

      {/* Chat List */}
      <div className="p-4">
        <Link href="/chat" data-testid="link-anonymous-chat">
          <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 hover:bg-zinc-800 transition-colors cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-zinc-700 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-white" data-testid="text-chat-name">
                    Анонимный чат
                  </h3>
                  <p className="text-sm text-zinc-400" data-testid="text-chat-description">
                    Общайтесь анонимно с другими участниками
                  </p>
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