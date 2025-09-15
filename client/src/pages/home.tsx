import { useAuth } from '@/lib/auth';
import { motion } from 'framer-motion';
import { Zap, Shield, MessageSquare, Users, Rocket, Lock } from 'lucide-react';

export default function HomePage() {
  const auth = useAuth();

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-[#0a001a] to-[#050010] text-white pb-20">
      <div className="flex flex-col items-center p-6 space-y-8">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4 max-w-2xl mt-8"
        >
          <div className="relative inline-block">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
              AguGram
            </h1>
            <div className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_#00ff0080]"></div>
          </div>
          <p className="text-lg text-gray-300">
            Анонимная студенческая социальная сеть будущего
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-indigo-300">
            <Zap className="w-4 h-4" />
            <span>Мгновенный доступ • Без регистрации • Полная анонимность</span>
          </div>
        </motion.div>


        {/* Feature Cards */}
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">
          <FeatureCard
            icon={<MessageSquare className="w-6 h-6 text-cyan-400" />}
            title="Анонимные чаты"
            description="Общайтесь с студентами не раскрывая личность"
            glowColor="cyan"
            delay={0.3}
          />
          <FeatureCard
            icon={<Rocket className="w-6 h-6 text-violet-400" />}
            title="Мгновенный доступ"
            description="Без ожидания одобрения - начинайте общение сразу"
            glowColor="violet"
            delay={0.4}
          />
          <FeatureCard
            icon={<Shield className="w-6 h-6 text-green-400" />}
            title="Полная приватность"
            description="Ваши данные защищены криптографией будущего"
            glowColor="green"
            delay={0.5}
          />
          <FeatureCard
            icon={<Users className="w-6 h-6 text-pink-400" />}
            title="Сообщество студентов"
            description="Находите единомышленников и обменивайтесь опытом"
            glowColor="pink"
            delay={0.6}
          />
        </div>

        {/* Bottom Row - User Card and Privacy */}
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6">
          {/* User Profile Card - moved here */}
          {auth.user && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
            >
              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-6 border-2 border-cyan-500/30 shadow-[0_0_20px_#00ffff20]">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 via-violet-400 to-pink-400 flex items-center justify-center text-black font-bold text-lg">
                    {auth.user.anonName?.charAt(auth.user.anonName.length - 1) || '?'}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{auth.user.anonName}</h3>
                    <p className="text-sm text-cyan-300">ID: {auth.user.id}</p>
                  </div>
                  <div className="ml-auto w-3 h-3 rounded-full bg-green-400 animate-pulse"></div>
                </div>
                <div className="bg-white/5 rounded-xl p-3">
                  <p className="text-sm text-gray-300">Статус: <span className="text-green-400 font-medium">Активен</span></p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Security Notice */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
          >
            <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-white/10 h-full">
              <div className="flex items-center gap-3 mb-3">
                <Lock className="w-6 h-6 text-indigo-400" />
                <h3 className="text-lg font-semibold text-white">Защита данных</h3>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                Все сообщения шифруются end-to-end. Ваша настоящая личность остается скрытой - 
                в чатах отображается только анонимное имя. Полная приватность гарантирована.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description, glowColor, delay }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  glowColor: 'cyan' | 'violet' | 'green' | 'pink';
  delay: number;
}) {
  const glowColors = {
    cyan: 'border-cyan-500/30 shadow-[0_0_15px_#00ffff20] hover:shadow-[0_0_25px_#00ffff40]',
    violet: 'border-violet-500/30 shadow-[0_0_15px_#8b5cf640] hover:shadow-[0_0_25px_#8b5cf660]',
    green: 'border-green-500/30 shadow-[0_0_15px_#00ff0020] hover:shadow-[0_0_25px_#00ff0040]',
    pink: 'border-pink-500/30 shadow-[0_0_15px_#ff69b420] hover:shadow-[0_0_25px_#ff69b440]'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ scale: 1.02 }}
      className={`bg-black/40 backdrop-blur-md rounded-2xl p-6 border-2 ${glowColors[glowColor as keyof typeof glowColors]} transition-all duration-300 cursor-pointer`}
    >
      <div className="flex items-start space-x-4">
        <div className="mt-1">{icon}</div>
        <div>
          <h3 className="font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-gray-300">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}