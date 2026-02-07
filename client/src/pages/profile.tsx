import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Star, Send, Instagram, Settings, Plus, EyeOff, Edit2, Camera, X, Save, Link as LinkIcon } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTelegramPadding } from '@/hooks/useTelegramPadding';
import maleProfile from '@/assets/male_profile.jpg';
import femaleProfile from '@/assets/female_profile.jpg';
import type { UserStatistics } from '@/types';

export default function ProfilePage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { topPadding } = useTelegramPadding();
  const [profile, setProfile] = useState<any>(null);
  const [statistics, setStatistics] = useState<UserStatistics>({ popularity: 0, views: 0, friendRequests: 0 });
  const [activeProfile, setActiveProfile] = useState<'main' | 'anon'>('main');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editLinkOpen, setEditLinkOpen] = useState(false);
  const [currentEditLink, setCurrentEditLink] = useState<'telegram' | 'vk' | 'instagram' | null>(null);
  const [linkValue, setLinkValue] = useState('');
  const [editingData, setEditingData] = useState({ displayName: '', course: '', direction: '', bio: '' });
  const [mainAvatar, setMainAvatar] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<(string | null)[]>([null, null, null]);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);
  const [socialLinks, setSocialLinks] = useState({ telegram: '', vk: '', instagram: '' });

  // Load user profile data with React Query for caching
  const { data: profileData } = useQuery({
    queryKey: ['user-profile', auth.user?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/profile');
      if (!response.ok) throw new Error('Failed to load profile');
      const data = await response.json();
      return data.profile;
    },
    enabled: auth.isAuthenticated(),
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false // Don't refetch on window focus to reduce requests
  });

  // Load statistics with React Query
  const { data: statsData } = useQuery({
    queryKey: ['user-statistics', auth.user?.id],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/statistics/user');
      if (!response.ok) return { popularity: 0, views: 0, friendRequests: 0 };
      const data = await response.json();
      return {
        popularity: data.popularity || 0,
        views: data.views || 0,
        friendRequests: data.friendRequests || 0
      };
    },
    enabled: auth.isAuthenticated(),
    staleTime: 30000,
    refetchOnWindowFocus: false
  });

  // Update local state when profile data loads
  useEffect(() => {
    if (profileData) {
      setProfile(profileData);
      setEditingData({
        displayName: profileData?.displayName || '',
        course: profileData?.course || '',
        direction: profileData?.direction || '',
        bio: profileData?.bio || ''
      });
      setSocialLinks({
        telegram: profileData?.telegram || '',
        vk: profileData?.vk || '',
        instagram: profileData?.instagram || ''
      });
    }
  }, [profileData]);

  // Update statistics when data loads
  useEffect(() => {
    if (statsData) {
      setStatistics(statsData);
    }
  }, [statsData]);

  // Memoize avatar to prevent re-computation on every render
  // For main profile: use Telegram photo > uploaded avatar > gender-based default
  // For anon profile: use gender-based default only
  const profileAvatar = useMemo(() => {
    if (mainAvatar) return mainAvatar;
    if (!profile?.gender) return undefined;
    return profile.gender === 'male' ? maleProfile : femaleProfile;
  }, [mainAvatar, profile?.gender]);

  // Main profile avatar prioritizes real Telegram photo
  const mainProfileAvatar = useMemo(() => {
    if (profile?.telegramPhotoUrl) return profile.telegramPhotoUrl;
    if (profile?.avatarUrl) return profile.avatarUrl;
    if (mainAvatar) return mainAvatar;
    if (!profile?.gender) return undefined;
    return profile.gender === 'male' ? maleProfile : femaleProfile;
  }, [profile?.telegramPhotoUrl, profile?.avatarUrl, mainAvatar, profile?.gender]);

  // Anon profile uses default avatars only
  const anonProfileAvatar = useMemo(() => {
    if (!profile?.gender) return undefined;
    return profile.gender === 'male' ? maleProfile : femaleProfile;
  }, [profile?.gender]);

  const handleEditProfile = () => {
    setMenuOpen(false);
    setEditProfileOpen(true);
  };

  const handleSaveProfile = async () => {
    try {
      const profileUpdate = {
        displayName: editingData.displayName,
        course: editingData.course,
        direction: editingData.direction,
        bio: editingData.bio,
        gender: profile?.gender,
        telegram: socialLinks.telegram,
        vk: socialLinks.vk,
        instagram: socialLinks.instagram
      };
      
      const response = await apiRequest('PATCH', '/api/profile', profileUpdate);
      if (response.ok) {
        const data = await response.json();
        setProfile(data.profile);
        // Update social links state
        setSocialLinks({
          telegram: data.profile?.telegram || '',
          vk: data.profile?.vk || '',
          instagram: data.profile?.instagram || ''
        });
        // Invalidate and refetch profile cache
        queryClient.invalidateQueries({ queryKey: ['user-profile', auth.user?.id] });
        setEditProfileOpen(false);
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      alert('Ошибка при сохранении профиля');
    }
  };

  const handleChangePhoto = () => {
    setMenuOpen(false);
    // Show coming soon modal instead of file picker
    setComingSoonOpen(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Placeholder - feature coming soon
    setComingSoonOpen(true);
  };

  const handlePhotoClick = (index: number) => {
    // Show coming soon modal instead of file picker
    setComingSoonOpen(true);
  };

  const handlePhotoChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    // Placeholder - feature coming soon
    setComingSoonOpen(true);
  };

  const handleDeletePhoto = (index: number) => {
    // Placeholder - feature coming soon
    setComingSoonOpen(true);
  };

  const handleEditLink = (type: 'telegram' | 'vk' | 'instagram') => {
    setCurrentEditLink(type);
    setLinkValue(socialLinks[type]);
    setEditLinkOpen(true);
  };

  const handleSaveLink = async () => {
    if (currentEditLink) {
      const updatedLinks = { ...socialLinks, [currentEditLink]: linkValue };
      setSocialLinks(updatedLinks);
      
      // Save to server - need to send full profile to pass validation
      try {
        const profileUpdate = {
          displayName: editingData.displayName || profile?.displayName,
          course: editingData.course || profile?.course,
          direction: editingData.direction || profile?.direction,
          bio: editingData.bio || profile?.bio,
          gender: profile?.gender,
          telegram: updatedLinks.telegram,
          vk: updatedLinks.vk,
          instagram: updatedLinks.instagram
        };
        
        const response = await apiRequest('PATCH', '/api/profile', profileUpdate);
        
        if (response.ok) {
          const data = await response.json();
          setProfile(data.profile);
          // Invalidate and refetch profile cache
          queryClient.invalidateQueries({ queryKey: ['user-profile', auth.user?.id] });
        }
      } catch (error) {
        console.error('Failed to save social link:', error);
        alert('Ошибка при сохранении ссылки');
      }
    }
    setEditLinkOpen(false);
    setCurrentEditLink(null);
    setLinkValue('');
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-[#0a001a] to-[#050010] text-white p-6 flex flex-col items-center pb-20" style={{ paddingTop: topPadding > 0 ? `${topPadding + 24}px` : '24px' }}>
      {/* Compact Switcher */}
      <div className="fixed left-6 flex items-center bg-zinc-800 rounded-full p-1 z-50" style={{ top: topPadding > 0 ? `${topPadding + 24}px` : '24px' }}>
        {([
          { key: "main" as const, icon: "👤" },
          { key: "anon" as const, icon: "🎭" },
        ]).map((profile) => (
          <motion.div
            key={profile.key}
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveProfile(profile.key)}
            className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${
              activeProfile === profile.key ? "bg-white text-black" : "bg-transparent text-white"
            }`}
            data-testid={`button-profile-${profile.key}`}
          >
            <span className="text-lg">{profile.icon}</span>
          </motion.div>
        ))}
      </div>

      {/* Menu button */}
      <div className="fixed right-6 z-50" style={{ top: topPadding > 0 ? `${topPadding + 24}px` : '24px' }}>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
              menuOpen ? 'bg-violet-600' : 'bg-black hover:bg-violet-600'
            }`}
            data-testid="button-menu"
          >
            <Settings className="text-white" />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-lg overflow-hidden"
              >
                <ul className="flex flex-col text-left">
                  <li 
                    onClick={handleEditProfile}
                    className="px-6 py-4 hover:bg-violet-500/20 cursor-pointer transition-all duration-200 flex items-center gap-3 border-b border-white/10" 
                    data-testid="menu-edit-profile"
                  >
                    <Edit2 className="w-5 h-5 text-violet-400" />
                    <span className="text-base font-semibold text-white">Редактировать</span>
                  </li>
                  <li 
                    onClick={handleChangePhoto}
                    className="px-6 py-4 hover:bg-violet-500/20 cursor-pointer transition-all duration-200 flex items-center gap-3 border-b border-white/10" 
                    data-testid="menu-change-photo"
                  >
                    <Camera className="w-5 h-5 text-cyan-400" />
                    <span className="text-base font-semibold text-white">Изменить фото</span>
                  </li>
                  <li className="px-6 py-4 hover:bg-violet-500/20 cursor-pointer transition-all duration-200 flex items-center gap-3 border-b border-white/10" data-testid="menu-help">
                    <span className="text-2xl">❓</span>
                    <span className="text-base font-semibold text-white">Помощь</span>
                  </li>
                  <li className="px-6 py-4 hover:bg-violet-500/20 cursor-pointer transition-all duration-200 flex items-center gap-3" data-testid="menu-settings">
                    <Settings className="w-5 h-5 text-pink-400" />
                    <span className="text-base font-semibold text-white">Настройки</span>
                  </li>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Animated profile switch */}
      <div className="w-full max-w-3xl mt-10">
        <AnimatePresence mode="wait">
          {activeProfile === "main" ? (
            <motion.div
              key="main"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center space-y-6"
            >
              <div 
                className="relative w-32 h-32 rounded-full overflow-visible flex items-center justify-center bg-gradient-to-br from-pink-500 via-cyan-500 to-violet-500"
              >
                <div className="absolute inset-0 rounded-full overflow-hidden">
                  {mainProfileAvatar ? (
                    <img src={mainProfileAvatar} alt="Profile" className="w-full h-full object-cover" loading="eager" />
                  ) : (
                    <span className="text-3xl font-bold text-white flex items-center justify-center h-full">?</span>
                  )}
                </div>
                <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-400 animate-pulse border-2 border-black z-10"></div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <h1 className="text-2xl font-bold text-white" data-testid="text-profile-name">
                {profile?.displayName || 'Пользователь'}
              </h1>
              <p className="text-sm text-indigo-300" data-testid="text-profile-course">
                {profile?.course && profile?.direction ? `${profile.course} курс • ${profile.direction}` : 'Профиль не заполнен'}
              </p>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4 w-full">
                <MetricCard
                  icon={<Heart className="text-red-500 fill-red-500" />}
                  value={statistics.friendRequests.toString()}
                  label="Знакомства"
                  borderColor="border-red-500 shadow-[0_0_10px_#ff000080]"
                />
                <MetricCard
                  icon={<Star className="text-yellow-400 fill-yellow-400" />}
                  value={statistics.popularity.toString()}
                  label="Популярность"
                  borderColor="border-yellow-400 shadow-[0_0_10px_#ffff0080]"
                />
              </div>

              {/* About */}
              <Section title="О себе">
                <p className="text-gray-300" data-testid="text-profile-bio">
                  {profile?.bio || 'Пользователь ещё не рассказал о себе.'}
                </p>
              </Section>

              {/* Links */}
              <Section title="Ссылки">
                <div className="flex justify-center items-center gap-6 pb-2">
                  <SocialButton 
                    icon={<Send className="w-6 h-6 text-cyan-400" />} 
                    label="Telegram" 
                    onClick={() => handleEditLink('telegram')}
                    hasLink={!!socialLinks.telegram}
                  />
                  <SocialButton 
                    icon={<div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">VK</div>} 
                    label="Vkontakte" 
                    onClick={() => handleEditLink('vk')}
                    hasLink={!!socialLinks.vk}
                  />
                  <SocialButton 
                    icon={<Instagram className="w-6 h-6 text-violet-400" />} 
                    label="Instagram" 
                    onClick={() => handleEditLink('instagram')}
                    hasLink={!!socialLinks.instagram}
                  />
                </div>
              </Section>

              {/* Album */}
              <Section title="Фотоальбом">
                <div className="grid grid-cols-3 gap-3">
                  {selectedPhotos.map((photo, i) => (
                    <motion.div
                      key={i}
                      className="relative rounded-xl overflow-hidden border border-zinc-600 flex items-center justify-center bg-zinc-800 aspect-[3/4] cursor-pointer hover:border-violet-400 transition-colors"
                      data-testid={`photo-slot-${i}`}
                      onClick={() => !photo && handlePhotoClick(i)}
                    >
                      {photo ? (
                        <>
                          <img src={photo} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePhoto(i);
                            }}
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </>
                      ) : (
                        <Plus className="w-6 h-6 text-white/60" />
                      )}
                      <input
                        ref={(el) => (photoInputRefs.current[i] = el)}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handlePhotoChange(i, e)}
                      />
                    </motion.div>
                  ))}
                </div>
              </Section>
            </motion.div>
          ) : (
            <motion.div
              key="anon"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center space-y-6"
            >
              <div className="relative w-32 h-32 rounded-full overflow-visible flex items-center justify-center bg-gradient-to-br from-pink-500 via-cyan-500 to-violet-500">
                <div className="absolute inset-0 rounded-full overflow-hidden">
                  {anonProfileAvatar ? (
                    <img src={anonProfileAvatar} alt="Anonymous Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-white flex items-center justify-center h-full">?</span>
                  )}
                </div>
                <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-400 animate-pulse border-2 border-black z-10"></div>
              </div>
              <h2 className="text-2xl font-bold" data-testid="text-anon-name">{auth.user?.anonName || 'Student_1'}</h2>

              {/* Metrics - Hidden in anonymous profile */}
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

              {/* About blurred */}
              <Section title="О себе" locked>
                <p className="text-gray-300 blur-sm select-none">
                  Люблю создавать интерфейсы будущего. Код для меня — это искусство, а дизайн — способ общения. Люблю создавать интерфейсы будущего. Код для меня — это искусство, а дизайн — способ общения.
                </p>
              </Section>

              {/* Links blurred */}
              <Section title="Ссылки" locked>
                <div className="flex gap-3 overflow-x-auto pb-2 opacity-50 blur-[1px]">
                  <SocialButton icon={<Send className="w-6 h-6 text-cyan-400" />} label="Telegram" />
                  <SocialButton icon={<div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">VK</div>} label="Vkontakte" />
                  <SocialButton icon={<Instagram className="w-6 h-6 text-violet-400" />} label="Instagram" />
                </div>
              </Section>

              {/* Album blurred */}
              <Section title="Фотоальбом" locked>
                <div className="grid grid-cols-3 gap-3">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="rounded-xl overflow-hidden border border-zinc-600 flex items-center justify-center bg-zinc-800 aspect-[3/4]"
                    >
                      <EyeOff className="w-6 h-6 text-white/60" />
                    </motion.div>
                  ))}
                </div>
              </Section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="bg-zinc-900 border border-zinc-700 text-white w-[90%] max-w-[500px] rounded-[25px]" hideClose>
          <button
            onClick={() => setEditProfileOpen(false)}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white hover:bg-zinc-700 rounded-full transition-colors z-50"
          >
            <X className="w-5 h-5 font-bold" strokeWidth={3} />
          </button>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#a855f7]">
              Профиль
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Отредактируйте информацию вашего профиля
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Имя</label>
              <Input
                value={editingData.displayName}
                onChange={(e) => setEditingData(prev => ({ ...prev, displayName: e.target.value }))}
                className="bg-zinc-800 border-zinc-600 text-white"
                placeholder="Введите имя"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Курс</label>
              <Select 
                value={editingData.course} 
                onValueChange={(value) => setEditingData(prev => ({ ...prev, course: value }))}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-600 text-white">
                  <SelectValue placeholder="Выберите курс" />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 rounded-xl">
                  {['1', '2', '3', '4', '5', '6'].map(course => (
                    <SelectItem key={course} value={course} className="text-gray-900 focus:bg-purple-50">{course} курс</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Направление</label>
              <Input
                value={editingData.direction}
                onChange={(e) => setEditingData(prev => ({ ...prev, direction: e.target.value }))}
                className="bg-zinc-800 border-zinc-600 text-white"
                placeholder="Например: Информатика"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">О себе</label>
              <Textarea
                value={editingData.bio}
                onChange={(e) => setEditingData(prev => ({ ...prev, bio: e.target.value }))}
                className="bg-zinc-800 border-zinc-600 text-white min-h-[100px]"
                placeholder="Расскажите о себе"
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-3">
            <Button
              onClick={handleSaveProfile}
              className="w-full bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              Сохранить
            </Button>
            <Button
              onClick={() => setEditProfileOpen(false)}
              variant="outline"
              className="w-full bg-zinc-800 border-zinc-600 text-white hover:bg-zinc-700"
            >
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Link Dialog */}
      <Dialog open={editLinkOpen} onOpenChange={setEditLinkOpen}>
        <DialogContent className="bg-zinc-900 border border-zinc-700 text-white w-[90%] max-w-[500px] rounded-[25px]" hideClose>
          <button
            onClick={() => setEditLinkOpen(false)}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white hover:bg-zinc-700 rounded-full transition-colors z-50"
          >
            <X className="w-5 h-5 font-bold" strokeWidth={3} />
          </button>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#a855f7]">
              {currentEditLink === 'telegram' ? 'Telegram' : currentEditLink === 'vk' ? 'VKontakte' : 'Instagram'}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Добавьте ссылку на ваш профиль в социальной сети
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block flex items-center gap-2">
                <LinkIcon className="w-4 h-4" />
                Ссылка на профиль
              </label>
              <Input
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                className="bg-zinc-800 border-zinc-600 text-white"
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-3">
            <Button
              onClick={handleSaveLink}
              className="w-full bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              Сохранить
            </Button>
            <Button
              onClick={() => setEditLinkOpen(false)}
              variant="outline"
              className="w-full bg-zinc-800 border-zinc-600 text-white hover:bg-zinc-700"
            >
              <X className="w-4 h-4 mr-2" />
              Отмена
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coming Soon Dialog */}
      <Dialog open={comingSoonOpen} onOpenChange={setComingSoonOpen}>
        <DialogContent className="bg-zinc-900 border border-zinc-700 text-white w-[90%] max-w-[400px] rounded-[25px]" hideClose>
          <button
            onClick={() => setComingSoonOpen(false)}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-white hover:bg-zinc-700 rounded-full transition-colors z-50"
          >
            <X className="w-5 h-5 font-bold" strokeWidth={3} />
          </button>
          <div className="flex flex-col items-center text-center py-6">
            <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-4 border border-zinc-700">
              <Camera className="w-10 h-10 text-violet-400" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                Скоро!
              </DialogTitle>
              <DialogDescription className="text-gray-300 mt-3 text-base leading-relaxed">
                Загрузка и редактирование фотографий появится в следующем обновлении. Мы активно работаем над этой функцией! 📸
              </DialogDescription>
            </DialogHeader>
            <Button
              onClick={() => setComingSoonOpen(false)}
              className="mt-6 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 text-white px-8"
            >
              Понятно
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({ icon, value, label, borderColor }: { icon: React.ReactNode, value: string, label: string, borderColor: string }) {
  return (
    <div>
      <Card className={`rounded-2xl bg-transparent border-2 ${borderColor} overflow-hidden`}>
        <CardContent className="flex flex-col items-center py-2 text-white">
          <div className="mb-1">{icon}</div>
          <p className="text-xl font-bold" data-testid={`metric-${label.toLowerCase()}`}>{value}</p>
          <span className="text-xs">{label}</span>
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, children, locked }: { title: string, children: React.ReactNode, locked?: boolean }) {
  return (
    <div className="space-y-2 mt-2 bg-zinc-900 rounded-xl p-3 w-full border border-zinc-700">
      <h2 className="font-semibold text-lg flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-white">•</span>
          {title}
        </span>
        {locked && <span className="text-white text-sm">🔒</span>}
      </h2>
      {children}
    </div>
  );
}

function SocialButton({ icon, label, onClick, hasLink }: { 
  icon: React.ReactNode, 
  label: string,
  onClick?: () => void,
  hasLink?: boolean
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      className="relative flex flex-col items-center justify-center w-24 h-24 bg-zinc-800 border border-zinc-700 rounded-xl transition-all cursor-pointer hover:border-violet-500"
      data-testid={`social-${label.toLowerCase()}`}
    >
      <div className="mb-2">{icon}</div>
      <span className="text-sm">{label}</span>
    </motion.div>
  );
}