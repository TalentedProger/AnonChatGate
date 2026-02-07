import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Heart, Star, ChevronLeft, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation, useRoute } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { showBackButton } from '@/lib/telegram';
import { useTelegramPadding } from '@/hooks/useTelegramPadding';
import maleProfile from '@/assets/male_profile.jpg';
import femaleProfile from '@/assets/female_profile.jpg';

interface UserProfile {
  id: number;
  anonName: string;
  gender?: string | null;
  course?: string | null;
  direction?: string | null;
  bio?: string | null;
}

// Section component (same as profile.tsx)
function Section({ title, children, locked }: { title: string; children: React.ReactNode; locked?: boolean }) {
  return (
    <Card className="w-full bg-white/5 border border-white/20 rounded-2xl overflow-hidden">
      <CardContent className="p-5 relative">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {locked && <EyeOff className="w-4 h-4 text-gray-500" />}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

// MetricCard component (same as profile.tsx)
function MetricCard({ icon, value, label, borderColor }: { icon: React.ReactNode; value: string; label: string; borderColor: string }) {
  return (
    <motion.div 
      className={`rounded-2xl p-4 flex flex-col items-center justify-center bg-white/5 border ${borderColor}`}
      whileHover={{ scale: 1.02 }}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <span className="text-xl font-bold text-white">{value}</span>
      <span className="text-xs text-gray-400">{label}</span>
    </motion.div>
  );
}

export default function UserProfilePage() {
  const [, params] = useRoute('/user/:userId');
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { topPadding } = useTelegramPadding();

  const userId = params?.userId;

  // Setup Telegram back button
  useEffect(() => {
    const cleanup = showBackButton(() => {
      window.history.back();
    });
    return cleanup;
  }, []);

  // Load user profile
  useEffect(() => {
    if (!userId) {
      setError('Пользователь не найден');
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const response = await apiRequest('GET', `/api/user/${userId}/profile`);
        if (response.ok) {
          const data = await response.json();
          setProfile(data.profile);
        } else {
          setError('Не удалось загрузить профиль');
        }
      } catch (err) {
        setError('Ошибка при загрузке профиля');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  const handleBack = () => {
    window.history.back();
  };

  const handleFavorite = () => {
    // TODO: Implement favorites functionality
    console.log('Add to favorites:', userId);
  };

  // Get avatar based on gender
  const getAvatar = () => {
    if (!profile?.gender) return maleProfile;
    return profile.gender === 'male' ? maleProfile : femaleProfile;
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-black via-[#0a001a] to-[#050010] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-zinc-400">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-black via-[#0a001a] to-[#050010] text-white flex flex-col">
        {/* Header with back button */}
        <div className="fixed top-6 left-6 z-50">
          <button 
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-zinc-400">{error || 'Пользователь не найден'}</p>
            <button 
              onClick={handleBack}
              className="mt-4 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Вернуться
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-[#0a001a] to-[#050010] text-white p-6 flex flex-col items-center pb-20" style={{ paddingTop: topPadding > 0 ? `${topPadding + 24}px` : '24px' }}>
      {/* Back button */}
      <div className="fixed z-50" style={{ top: topPadding > 0 ? `${topPadding + 24}px` : '24px', left: '24px' }}>
        <button 
          onClick={handleBack}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Favorite button */}
      <div className="fixed z-50" style={{ top: topPadding > 0 ? `${topPadding + 24}px` : '24px', right: '24px' }}>
        <button 
          onClick={handleFavorite}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md hover:bg-pink-500/30 transition-colors"
        >
          <Heart className="w-5 h-5 text-pink-400" />
        </button>
      </div>

      {/* Profile content */}
      <div className="w-full max-w-3xl mt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center space-y-6"
        >
          {/* Avatar */}
          <div className="relative w-32 h-32 rounded-full overflow-visible flex items-center justify-center bg-gradient-to-br from-pink-500 via-cyan-500 to-violet-500">
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <img 
                src={getAvatar()} 
                alt="Profile" 
                className="w-full h-full object-cover" 
                loading="eager" 
              />
            </div>
            <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-gray-400 border-2 border-black z-10"></div>
          </div>

          {/* Name */}
          <h2 className="text-2xl font-bold text-white">{profile.anonName}</h2>
          
          {/* Course info */}
          <p className="text-sm text-indigo-300">
            {profile.course && profile.direction 
              ? `${profile.course} курс • ${profile.direction}` 
              : 'Анонимный пользователь'}
          </p>

          {/* Metrics - Hidden values */}
          <div className="grid grid-cols-2 gap-4 w-full">
            <MetricCard
              icon={<Heart className="text-red-500 fill-red-500" />}
              value="?"
              label="Знакомства"
              borderColor="border-red-500 shadow-[0_0_10px_#ff000080]"
            />
            <MetricCard
              icon={<Star className="text-yellow-400 fill-yellow-400" />}
              value="?"
              label="Популярность"
              borderColor="border-yellow-400 shadow-[0_0_10px_#ffff0080]"
            />
          </div>

          {/* About section - blurred */}
          <Section title="О себе" locked>
            <p className="text-gray-300 blur-sm select-none">
              {profile.bio || 'Информация скрыта. Чтобы узнать больше, отправьте запрос на знакомство.'}
            </p>
          </Section>

          {/* Links section - hidden */}
          <Section title="Ссылки" locked>
            <div className="flex justify-center items-center gap-6 pb-2">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center blur-sm">
                  <span className="text-cyan-400">TG</span>
                </div>
                <span className="text-xs text-gray-400">Telegram</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center blur-sm">
                  <span className="text-blue-500">VK</span>
                </div>
                <span className="text-xs text-gray-400">Vkontakte</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center blur-sm">
                  <span className="text-violet-400">IG</span>
                </div>
                <span className="text-xs text-gray-400">Instagram</span>
              </div>
            </div>
          </Section>

          {/* Photo album - hidden */}
          <Section title="Фотоальбом" locked>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden border border-white/30 flex items-center justify-center bg-white/5 aspect-[3/4] blur-sm"
                >
                  <span className="text-white/30 text-4xl">?</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Action button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleFavorite}
            className="w-full max-w-md py-4 bg-gradient-to-r from-pink-500 to-violet-500 rounded-2xl font-semibold text-white shadow-lg shadow-pink-500/30"
          >
            💕 Отправить запрос на знакомство
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
