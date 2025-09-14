import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Star, Send, Instagram, Settings, Plus, EyeOff } from "lucide-react";
import { useState } from "react";
import { useAuth } from '@/lib/auth';

export default function ProfilePage() {
  const auth = useAuth();
  const [activeProfile, setActiveProfile] = useState("main");
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-[#0a001a] to-[#050010] text-white p-6 flex flex-col items-center">
      {/* Compact Switcher */}
      <div className="fixed top-6 left-6 flex items-center bg-white/10 backdrop-blur-md rounded-full p-1 z-50">
        {[
          { key: "main", icon: "👤" },
          { key: "anon", icon: "🎭" },
        ].map((profile) => (
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
      <div className="fixed top-6 right-6 z-50">
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black hover:bg-violet-600 transition-colors"
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
                className="absolute right-0 mt-2 w-48 bg-black border border-gray-700 rounded-xl shadow-lg overflow-hidden"
              >
                <ul className="flex flex-col text-left text-sm">
                  <li className="px-4 py-2 hover:bg-gray-800 cursor-pointer" data-testid="menu-edit-profile">Редактировать профиль</li>
                  <li className="px-4 py-2 hover:bg-gray-800 cursor-pointer" data-testid="menu-change-photo">Изменить фото</li>
                  <li className="px-4 py-2 hover:bg-gray-800 cursor-pointer" data-testid="menu-help">Помощь</li>
                  <li className="px-4 py-2 hover:bg-gray-800 cursor-pointer" data-testid="menu-settings">Настройки</li>
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Animated profile switch */}
      <div className="w-full max-w-3xl mt-20">
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
              <div className="relative w-32 h-32 rounded-full flex items-center justify-center bg-gradient-to-br from-pink-500 via-cyan-500 to-violet-500">
                <span className="text-3xl font-bold text-white">1</span>
                <div className="absolute bottom-2 right-2 w-4 h-4 rounded-full bg-green-500 border-2 border-black"></div>
              </div>
              <h1 className="text-2xl font-bold text-white" data-testid="text-profile-name">CyberStudent</h1>
              <p className="text-sm text-indigo-300" data-testid="text-profile-course">3 курс • Прикладная информатика</p>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-4 w-full">
                <MetricCard
                  icon={<Heart className="text-red-500 fill-red-500" />}
                  value="128"
                  label="Знакомства"
                  borderColor="border-red-500 shadow-[0_0_10px_#ff000080]"
                />
                <MetricCard
                  icon={<Star className="text-yellow-400 fill-yellow-400" />}
                  value="542"
                  label="Популярность"
                  borderColor="border-yellow-400 shadow-[0_0_10px_#ffff0080]"
                />
              </div>

              {/* About */}
              <Section title="О себе">
                <p className="text-gray-300" data-testid="text-profile-bio">
                  Люблю создавать интерфейсы будущего. Код для меня — это искусство, а дизайн — способ общения. Люблю создавать интерфейсы будущего. Код для меня — это искусство, а дизайн — способ общения.
                </p>
              </Section>

              {/* Links */}
              <Section title="Ссылки">
                <div className="flex gap-3 overflow-x-auto pb-2">
                  <SocialButton icon={<Send className="w-6 h-6 text-cyan-400" />} label="Telegram" />
                  <SocialButton icon={<div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">VK</div>} label="Vkontakte" />
                  <SocialButton icon={<Instagram className="w-6 h-6 text-violet-400" />} label="Instagram" />
                </div>
              </Section>

              {/* Album */}
              <Section title="Фотоальбом">
                <div className="grid grid-cols-3 gap-3">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="rounded-xl overflow-hidden border border-white/30 flex items-center justify-center bg-white/10 aspect-[3/4]"
                      data-testid={`photo-slot-${i}`}
                    >
                      <Plus className="w-6 h-6 text-white/60" />
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
              <div className="relative w-32 h-32 rounded-full flex items-center justify-center bg-gradient-to-br from-pink-500 via-cyan-500 to-violet-500">
                <span className="text-3xl font-bold text-white">1</span>
                <div className="absolute bottom-2 right-2 w-4 h-4 rounded-full bg-green-500 border-2 border-black"></div>
              </div>
              <h2 className="text-2xl font-bold" data-testid="text-anon-name">{auth.user?.anonName || 'Student_1'}</h2>

              {/* Metrics */}
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
                      className="rounded-xl overflow-hidden border border-white/30 flex items-center justify-center bg-white/10 aspect-[3/4]"
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
    <div className="space-y-2 mt-2 bg-black/20 rounded-xl p-3 w-full shadow-md shadow-white/5">
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

function SocialButton({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <motion.div
      whileHover={{ boxShadow: "0 0 15px rgba(177, 0, 255, 0.6)" }}
      className="flex flex-col items-center justify-center w-24 h-24 bg-black/40 rounded-xl transition-all"
      data-testid={`social-${label.toLowerCase()}`}
    >
      <div className="mb-2">{icon}</div>
      <span className="text-sm">{label}</span>
    </motion.div>
  );
}