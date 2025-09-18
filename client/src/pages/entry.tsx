import { motion } from "framer-motion";
import { useLocation } from "wouter";

export default function EntryPage() {
  const [, setLocation] = useLocation();

  const handleStart = () => {
    setLocation('/register');
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#0A1A2F] to-black text-white flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-[428px] h-[926px] flex flex-col items-center justify-between px-7 py-12 box-border">
        {/* Top area with logo and headings */}
        <div className="w-full flex flex-col items-center">
          <div className="w-60 h-60 flex items-center justify-center mb-4">
            <svg width="240" height="240" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logoGradient" x1="0" x2="1">
                  <stop offset="0" stopColor="#C42DFF"/>
                  <stop offset="1" stopColor="#4A90FF"/>
                </linearGradient>
              </defs>
              <rect width="120" height="120" rx="20" fill="url(#logoGradient)" opacity="0.12" />
              <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" className="font-extrabold fill-[#58A0FF]" fontSize="56" fontFamily="Raleway">A</text>
            </svg>
          </div>

          <h1 className="text-[44px] leading-none text-[#5800EF] text-center font-extrabold mb-6">
            AguGram - первая соцсеть для студентов
          </h1>
          <h2 className="text-2xl text-white text-center font-semibold mt-11">
            Сообщество, где быть внутри — уже привилегия
          </h2>
        </div>

        {/* Bottom area with button and created-by */}
        <div className="w-full flex flex-col items-center">
          <motion.button 
            onClick={handleStart}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full max-w-[360px] h-20 bg-transparent border border-transparent rounded-[35px] relative flex items-center overflow-hidden"
            style={{
              background: 'transparent',
              backgroundClip: 'padding-box',
            }}
          >
            {/* Gradient border */}
            <div className="absolute inset-0 rounded-[35px] p-[1px] bg-gradient-to-r from-[#C42DFF] to-[#4A90FF]">
              <div className="w-full h-full bg-black rounded-[34px]"></div>
            </div>

            {/* Button content */}
            <div className="relative z-10 w-full h-full flex items-center">
              {/* Icon circle */}
              <div className="w-[70px] h-[70px] flex items-center justify-start pl-[5px] py-[5px]">
                <div className="w-[60px] h-[60px] rounded-full bg-gradient-to-r from-[#C42DFF] to-[#4A90FF] flex items-center justify-center flex-shrink-0">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2Z" fill="white" opacity="0.06"/>
                    <path d="M9 12L11.5 14.5L11.5 9.5L9 12Z" fill="white"/>
                  </svg>
                </div>
              </div>

              {/* Button text */}
              <div className="ml-[66px] text-xl font-semibold text-white">
                Start
              </div>

              {/* Arrow icons */}
              <div className="ml-12 flex gap-1.5 items-center">
                {[...Array(3)].map((_, i) => (
                  <svg key={i} className="w-[15px] h-[15px]" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 5l7 7-7 7" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ))}
              </div>
            </div>
          </motion.button>

          <div className="h-7"></div>

          <div className="flex items-center gap-4 text-lg">
            <div className="text-white/30">Created by</div>
            <div className="text-white font-bold blur-[4px] opacity-90">secret</div>
          </div>
        </div>
      </div>
    </div>
  );
}