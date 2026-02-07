import { useAuth } from '@/lib/auth';
import { motion } from 'framer-motion';
import { Zap, Shield, MessageSquare, Users, Rocket, Lock, TrendingUp, Newspaper, ChevronLeft, ChevronRight, Heart, X, Star } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay } from 'swiper/modules';
import 'swiper/css';

interface NewsItem {
  id: number;
  title: string;
  content: string;
  imageUrl: string | null;
  authorName: string | null;
  createdAt: string;
}

interface TopUser {
  userId: number;
  anonName: string;
  popularity: number;
}

interface FavoriteUser {
  id: number;
  favoriteUserId: number;
  favoriteUser: {
    id: number;
    anonName: string;
    gender: string | null;
    course: string | null;
    direction: string | null;
  };
  createdAt: string;
  monthKey: string;
}

export default function HomePage() {
  const auth = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [favorites, setFavorites] = useState<FavoriteUser[]>([]);
  const [canAddFavorite, setCanAddFavorite] = useState(true);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load news feed
        const newsResponse = await apiRequest('GET', '/api/news?limit=5');
        if (newsResponse.ok) {
          const newsData = await newsResponse.json();
          setNews(newsData.news || []);
        }

        // Load top users
        const usersResponse = await apiRequest('GET', '/api/statistics/top-users?limit=10');
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          setTopUsers(usersData.topUsers || []);
        }

        // Load favorites
        const favoritesResponse = await apiRequest('GET', '/api/favorites');
        if (favoritesResponse.ok) {
          const favoritesData = await favoritesResponse.json();
          setFavorites(favoritesData.favorites || []);
          setCanAddFavorite(favoritesData.canAddThisMonth);
        }
      } catch (error) {
        console.error('Failed to load home data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const nextNews = () => {
    setCurrentNewsIndex((prev) => (prev + 1) % news.length);
  };

  const prevNews = () => {
    setCurrentNewsIndex((prev) => (prev - 1 + news.length) % news.length);
  };

  const removeFavorite = async (favoriteUserId: number) => {
    try {
      const response = await apiRequest('DELETE', `/api/favorites/${favoriteUserId}`);
      if (response.ok) {
        setFavorites(prev => prev.filter(f => f.favoriteUserId !== favoriteUserId));
      }
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-[#0a001a] to-[#050010] text-white pb-20">
      <div className="flex flex-col items-center px-[5%] py-6">
        {/* Reserved space */}
        <div style={{ minHeight: loading ? '100vh' : 'auto' }}>
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4 w-full max-w-[90vw] mt-8"
        >
          <div className="relative inline-block">
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent pb-2">
              AguGram
            </h1>
          </div>
          <p className="text-lg text-gray-300">
            Анонимная социальная сеть
          </p>
        </motion.div>

        {/* User Profile Card - Mobile only - show after hero */}
        {auth.user && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="w-full max-w-[90vw] md:hidden min-h-avatar mt-4"
          >
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700">
              <div className="flex items-center space-x-4 mb-4">
                <div className="relative w-12 h-12 rounded-full overflow-visible bg-gradient-to-br from-cyan-400 via-violet-400 to-pink-400 flex items-center justify-center text-black font-bold text-lg">
                  {auth.user.anonName?.charAt(auth.user.anonName.length - 1) || '?'}
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 animate-pulse border-2 border-black z-10"></div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{auth.user.anonName}</h3>
                  <p className="text-sm text-cyan-300">ID: {auth.user.id}</p>
                </div>
              </div>
              <div className="bg-zinc-800 rounded-xl p-3">
                <p className="text-sm text-gray-300">Статус: <span className="text-green-400 font-medium">Активен</span></p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Feature Cards - Swiper */}
        <div className="w-full max-w-[90vw] mt-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Swiper
              modules={[Autoplay]}
              spaceBetween={20}
              slidesPerView={1}
              speed={800}
              autoplay={{
                delay: 5000,
                disableOnInteraction: false,
              }}
              className="feature-swiper w-full"
            >
              <SwiperSlide>
                <FeatureCard
                  icon={<MessageSquare className="w-6 h-6 text-cyan-400" />}
                  title="Анонимные чаты"
                  description="Общайтесь с студентами не раскрывая личность"
                  glowColor="cyan"
                />
              </SwiperSlide>
              <SwiperSlide>
                <FeatureCard
                  icon={<Rocket className="w-6 h-6 text-violet-400" />}
                  title="Мгновенный доступ"
                  description="Без ожидания одобрения - начинайте общение сразу"
                  glowColor="violet"
                />
              </SwiperSlide>
              <SwiperSlide>
                <FeatureCard
                  icon={<Shield className="w-6 h-6 text-green-400" />}
                  title="Полная приватность"
                  description="Ваши данные защищены криптографией будущего"
                  glowColor="green"
                />
              </SwiperSlide>
              <SwiperSlide>
                <FeatureCard
                  icon={<Users className="w-6 h-6 text-pink-400" />}
                  title="Сообщество студентов"
                  description="Находите единомышленников и обменивайтесь опытом"
                  glowColor="pink"
                />
              </SwiperSlide>
              <SwiperSlide>
                <FeatureCard
                  icon={<Lock className="w-6 h-6 text-indigo-400" />}
                  title="Защита данных"
                  description="Современные технологии безопасности для вашей конфиденциальности"
                  glowColor="indigo"
                />
              </SwiperSlide>
            </Swiper>
          </motion.div>
        </div>

        {/* News Section */}
        {(news.length > 0 || loading) && (
          <div className="w-full max-w-[95vw] min-h-card mt-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="bg-zinc-900 rounded-xl p-5 border border-zinc-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <Newspaper className="w-6 h-6 text-cyan-400" />
                <h3 className="text-xl font-semibold text-white">Новости</h3>
              </div>
              {loading ? (
                <div className="skeleton rounded-lg h-32"></div>
              ) : news.length === 0 ? (
                <div className="text-center text-gray-400 py-8">Новостей пока нет</div>
              ) : (
              <div className="relative flex items-center justify-center gap-2">
                {news.length > 1 && (
                  <button
                    onClick={prevNews}
                    className="flex-shrink-0 hover:scale-110 transition-transform p-1"
                    aria-label="Предыдущая новость"
                  >
                    <ChevronLeft className="w-6 h-6 text-white/70" />
                  </button>
                )}
                
                <div className="flex-1 overflow-hidden rounded-lg">
                  <motion.div
                    key={currentNewsIndex}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    transition={{ duration: 0.3 }}
                    className="bg-zinc-800 rounded-lg p-5 min-h-[260px] flex flex-col justify-between"
                  >
                    <div>
                      <h4 className="text-lg font-semibold text-white mb-3">{news[currentNewsIndex].title}</h4>
                      <p className="text-sm text-gray-300 line-clamp-5">{news[currentNewsIndex].content}</p>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs text-gray-500">
                        {news[currentNewsIndex].authorName || 'АгуГрам'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(news[currentNewsIndex].createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  </motion.div>
                </div>
                
                {news.length > 1 && (
                  <button
                    onClick={nextNews}
                    className="flex-shrink-0 hover:scale-110 transition-transform p-1"
                    aria-label="Следующая новость"
                  >
                    <ChevronRight className="w-6 h-6 text-white/70" />
                  </button>
                )}
              </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Favorites Section */}
        <div className="w-full max-w-[90vw] min-h-card mt-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.75 }}
            className="bg-zinc-900 rounded-xl p-6 border border-zinc-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Heart className="w-6 h-6 text-pink-400 fill-pink-400" />
                <h3 className="text-xl font-semibold text-white">Избранные</h3>
              </div>
              {canAddFavorite ? (
                <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
                  ✓ Можно добавить
                </span>
              ) : (
                <span className="text-xs text-gray-400 bg-zinc-800 px-2 py-1 rounded-full">
                  До след. месяца
                </span>
              )}
            </div>
            
            <p className="text-sm text-gray-400 mb-4">
              Выбирайте мудро — вы можете добавить только <span className="text-pink-400 font-semibold">1 человека в месяц</span> в избранное. 
              Это делает каждый выбор особенным! 💫
            </p>

            {favorites.length === 0 ? (
              <div className="text-center py-8">
                <Star className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-gray-400">У вас пока нет избранных</p>
                <p className="text-sm text-gray-500 mt-1">Добавляйте интересных людей из чата или профилей</p>
              </div>
            ) : (
              <div className="space-y-2">
                {favorites.map((favorite) => (
                  <div
                    key={favorite.id}
                    className="flex items-center justify-between bg-zinc-800 rounded-lg p-3 hover:bg-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-violet-500 flex items-center justify-center text-white font-bold">
                        {favorite.favoriteUser.anonName?.charAt(favorite.favoriteUser.anonName.length - 1) || '?'}
                      </div>
                      <div>
                        <span className="text-white font-medium">{favorite.favoriteUser.anonName}</span>
                        {favorite.favoriteUser.course && (
                          <p className="text-xs text-gray-400">
                            {favorite.favoriteUser.course} курс
                            {favorite.favoriteUser.direction && ` • ${favorite.favoriteUser.direction}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeFavorite(favorite.favoriteUserId)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/20 transition-colors"
                      title="Удалить из избранного"
                    >
                      <X className="w-4 h-4 text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Top Users Leaderboard */}
        {(topUsers.length > 0 || loading) && (
          <div className="w-full max-w-[90vw] min-h-card mt-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="bg-zinc-900 rounded-xl p-6 border border-zinc-700"
            >
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-6 h-6 text-yellow-400" />
                <h3 className="text-xl font-semibold text-white">Топ популярных пользователей</h3>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="skeleton rounded-lg h-14"></div>
                  ))}
                </div>
              ) : topUsers.length === 0 ? (
                <div className="text-center text-gray-400 py-8">Данные загружаются...</div>
              ) : (
              <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                <div className="space-y-2">
                  {topUsers.map((user, index) => (
                    <div
                      key={user.userId}
                      className="flex items-center justify-between bg-zinc-800 rounded-lg p-3 hover:bg-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-yellow-400 text-black' :
                          index === 1 ? 'bg-gray-300 text-black' :
                          index === 2 ? 'bg-orange-400 text-black' :
                          'bg-zinc-700 text-white'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="text-white font-medium">{user.anonName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-yellow-400" />
                        <span className="text-yellow-400 font-semibold">{user.popularity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              )}
            </motion.div>
          </div>
        )}

        {/* Bottom Row - User Card and Privacy */}
        <div className="w-full max-w-[90vw] grid md:grid-cols-2 gap-6 mt-4">
          {/* User Profile Card - Desktop only */}
          {auth.user && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="hidden md:block min-h-[200px]"
            >
              <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700 h-full">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="relative w-12 h-12 rounded-full overflow-visible bg-gradient-to-br from-cyan-400 via-violet-400 to-pink-400 flex items-center justify-center text-black font-bold text-lg">
                    {auth.user.anonName?.charAt(auth.user.anonName.length - 1) || '?'}
                    <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 animate-pulse border-2 border-black z-10"></div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{auth.user.anonName}</h3>
                    <p className="text-sm text-cyan-300">ID: {auth.user.id}</p>
                  </div>
                </div>
                <div className="bg-zinc-800 rounded-xl p-3">
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
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-700 h-full">
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
    </div>
  );
}

function FeatureCard({ icon, title, description, glowColor }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  glowColor: 'cyan' | 'violet' | 'green' | 'pink' | 'indigo';
}) {
  const glowColors = {
    cyan: 'border-cyan-500/30 shadow-[0_0_15px_#00ffff20] hover:shadow-[0_0_25px_#00ffff40]',
    violet: 'border-violet-500/30 shadow-[0_0_15px_#8b5cf640] hover:shadow-[0_0_25px_#8b5cf660]',
    green: 'border-green-500/30 shadow-[0_0_15px_#00ff0020] hover:shadow-[0_0_25px_#00ff0040]',
    pink: 'border-pink-500/30 shadow-[0_0_15px_#ff69b420] hover:shadow-[0_0_25px_#ff69b440]',
    indigo: 'border-indigo-500/30 shadow-[0_0_15px_#4f46e520] hover:shadow-[0_0_25px_#4f46e540]'
  };

  return (
    <div
      className={`bg-zinc-800/90 rounded-2xl p-6 border-2 ${glowColors[glowColor as keyof typeof glowColors]} transition-all duration-300 cursor-pointer hover:scale-[1.02] h-full`}
    >
      <div className="flex items-start space-x-4">
        <div className="mt-1">{icon}</div>
        <div>
          <h3 className="font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-gray-300">{description}</p>
        </div>
      </div>
    </div>
  );
}