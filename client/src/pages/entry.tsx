import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { logger } from "@/lib/logger";

export default function EntryPage() {
  const [, setLocation] = useLocation();
  const auth = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check if user is already authenticated on mount
  useEffect(() => {
    const checkExistingAuth = async () => {
      logger.log('[Entry] Checking existing auth, status:', auth.status);
      
      // Wait for auth manager to load from storage
      if (auth.status === 'loading') {
        // Auth is still loading, wait a bit
        setTimeout(() => setIsCheckingAuth(false), 100);
        return;
      }

      // If session expired, clear storage and show entry page
      if (auth.status === 'expired') {
        logger.log('[Entry] Session expired, need re-authentication');
        auth.clearAuth();
        setIsCheckingAuth(false);
        return;
      }

      // If authenticated with valid token
      if (auth.status === 'authenticated' && auth.token && auth.user) {
        logger.log('[Entry] User authenticated:', auth.user.anonName);
        
        // Check if profile is completed using the existing token
        try {
          const token = await auth.getValidToken();
          if (!token) {
            logger.log('[Entry] Could not get valid token, need re-auth');
            auth.clearAuth();
            setIsCheckingAuth(false);
            return;
          }
          
          const response = await fetch('/api/profile', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.profile?.profileCompleted) {
              logger.log('[Entry] Profile completed, redirecting to home');
              setLocation('/');
            } else {
              logger.log('[Entry] Profile not completed, redirecting to register');
              setLocation('/register');
            }
            return;
          } else if (response.status === 401) {
            // Token invalid, try to refresh
            logger.log('[Entry] Token invalid, trying to refresh');
            const refreshed = await auth.handleAuthError();
            if (refreshed) {
              // Retry after refresh
              const newToken = await auth.getValidToken();
              if (newToken) {
                const retryResponse = await fetch('/api/profile', {
                  headers: { 'Authorization': `Bearer ${newToken}` }
                });
                if (retryResponse.ok) {
                  const data = await retryResponse.json();
                  if (data.profile?.profileCompleted) {
                    setLocation('/');
                  } else {
                    setLocation('/register');
                  }
                  return;
                }
              }
            }
            // Refresh failed, need re-auth
            auth.clearAuth();
          }
        } catch (error) {
          logger.error('[Entry] Error checking profile:', error);
        }
      }
      
      setIsCheckingAuth(false);
    };

    checkExistingAuth();
  }, [auth.status]);

  const handleStart = async () => {
    if (isAuthenticating) return;
    
    setIsAuthenticating(true);
    
    try {
      const tg = (window as any).Telegram?.WebApp;
      
      logger.log('[Entry] Environment check:', {
        hasTelegram: !!tg,
        hasInitData: !!tg?.initData,
        initDataLength: tg?.initData?.length || 0,
        isDev: import.meta.env.DEV,
        platform: tg?.platform || 'unknown'
      });

      // Check if we already have a valid refresh token
      // If so, try to refresh instead of using Telegram auth
      if (auth.refreshToken) {
        logger.log('[Entry] Have refresh token, trying to use it');
        try {
          const refreshed = await auth.handleAuthError();
          if (refreshed) {
            const token = await auth.getValidToken();
            if (token) {
              // Successfully refreshed, check profile
              const profileResponse = await fetch('/api/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              
              if (profileResponse.ok) {
                const profileData = await profileResponse.json();
                if (profileData.profile?.profileCompleted) {
                  setLocation('/');
                } else {
                  setLocation('/register');
                }
                return;
              }
            }
          }
        } catch (error) {
          logger.log('[Entry] Refresh token failed, proceeding with new auth');
        }
      }

      // Try Telegram auth if available
      if (tg?.initData) {
        logger.log('[Entry] Authenticating with Telegram...');
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData: tg.initData })
        });

        if (response.ok) {
          const authData = await response.json();
          auth.setAuthData(authData);
          logger.log('[Entry] Telegram auth successful');
          
          // Check profile completion
          const profileResponse = await fetch('/api/profile', {
            headers: { 'Authorization': `Bearer ${authData.token}` }
          });
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            if (profileData.profile?.profileCompleted) {
              setLocation('/');
            } else {
              setLocation('/register');
            }
          } else {
            setLocation('/register');
          }
          return;
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          logger.error('[Entry] Telegram auth failed:', response.status, errorData);
          
          // If initData is invalid/expired, show message
          if (response.status === 401 && errorData.error === 'Invalid initData') {
            // Try dev auth if in development
            if (import.meta.env.DEV) {
              logger.log('[Entry] initData expired, falling back to dev auth');
            } else {
              alert('Сессия Telegram истекла. Пожалуйста, перезапустите приложение.');
              setIsAuthenticating(false);
              return;
            }
          } else {
            alert(`Ошибка авторизации: ${errorData.error || response.status}`);
            setIsAuthenticating(false);
            return;
          }
        }
      }
      
      // Dev authentication for development mode
      if (import.meta.env.DEV) {
        logger.log('[Entry] Using dev authentication');
        
        let devUserId = localStorage.getItem('dev_user_id');
        if (!devUserId) {
          devUserId = String(Date.now() + Math.floor(Math.random() * 10000));
          localStorage.setItem('dev_user_id', devUserId);
          logger.log('[Entry] Created new dev user ID:', devUserId);
        } else {
          logger.log('[Entry] Using existing dev user ID:', devUserId);
        }
        
        const response = await fetch('/api/auth/dev', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tgId: devUserId })
        });

        if (response.ok) {
          const authData = await response.json();
          auth.setAuthData(authData);
          logger.log('[Entry] Dev auth successful');
          
          const profileResponse = await fetch('/api/profile', {
            headers: { 'Authorization': `Bearer ${authData.token}` }
          });
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            if (profileData.profile?.profileCompleted) {
              setLocation('/');
            } else {
              setLocation('/register');
            }
          } else {
            setLocation('/register');
          }
          return;
        } else {
          logger.error('[Entry] Dev auth failed');
        }
      }
      
      // No authentication method available
      if (!tg?.initData && !import.meta.env.DEV) {
        logger.error('[Entry] No authentication method available');
        alert('Пожалуйста, откройте приложение через Telegram');
      }
      
      setIsAuthenticating(false);
    } catch (error) {
      logger.error('[Entry] Auth error:', error);
      alert('Произошла ошибка при авторизации. Попробуйте снова.');
      setIsAuthenticating(false);
    }
  };

  // Show loading while checking existing auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen w-full bg-gradient-to-b from-[#0A1A2F] to-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold" style={{ fontFamily: 'Raleway' }}>
            Загрузка...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#0A1A2F] to-black text-white flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-[428px] h-[926px] rounded-3xl flex flex-col items-center justify-between px-7 py-12 box-border">
        {/* Top area with logo and headings */}
        <div className="w-full flex flex-col items-center mt-3">
          <div className="w-60 h-60 flex items-center justify-center mb-0">
            <svg width="240" height="240" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logoGradient" x1="0" x2="1">
                  <stop offset="0" stopColor="#C42DFF"/>
                  <stop offset="1" stopColor="#4A90FF"/>
                </linearGradient>
              </defs>
              <rect width="120" height="120" rx="20" fill="url(#logoGradient)" opacity="0.12" />
              <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" style={{ fontFamily: 'Raleway', fontWeight: 800, fill: '#58A0FF' }} fontSize="56">A</text>
            </svg>
          </div>

          <h1 className="text-[44px] leading-[1.05] text-[#5800EF] text-center font-extrabold mb-0" style={{ fontFamily: 'Raleway' }}>
            AguGram - первая соцсеть для студентов
          </h1>
          <h2 className="text-2xl text-white text-center font-semibold mt-11" style={{ fontFamily: 'Raleway' }}>
            Сообщество, где быть внутри — уже привилегия
          </h2>
        </div>

        {/* Bottom area with button and created-by */}
        <div className="w-full flex flex-col items-center mb-1.5">
          <button 
            onClick={handleStart}
            disabled={isAuthenticating}
            className="w-full max-w-[360px] h-20 bg-transparent border border-transparent rounded-[35px] relative flex items-center overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-[1.02] active:scale-[0.98]"
            style={{ backgroundClip: 'padding-box' }}
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
              <div className="ml-[66px] text-xl font-semibold text-white" style={{ fontFamily: 'Raleway' }}>
                {isAuthenticating ? 'Загрузка...' : 'Start'}
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
          </button>

          <div className="h-7"></div>

          <div className="flex items-center gap-4 text-lg" style={{ fontFamily: 'Raleway' }}>
            <div className="text-white/30">Created by</div>
            <div className="text-white font-bold blur-[4px] opacity-90">secret</div>
          </div>
        </div>
      </div>
    </div>
  );
}
