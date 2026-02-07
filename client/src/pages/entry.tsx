import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useState, useEffect, useRef, useCallback } from "react";
import { logger } from "@/lib/logger";
import entryLogo from "@/assets/entry_logo.png";

export default function EntryPage() {
  const [, setLocation] = useLocation();
  const auth = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Slider state
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate max position (container width - slider width - padding)
  const getMaxPosition = useCallback(() => {
    if (!containerRef.current || !sliderRef.current) return 240;
    const containerWidth = containerRef.current.offsetWidth;
    const sliderWidth = sliderRef.current.offsetWidth;
    return containerWidth - sliderWidth - 10; // 5px padding each side
  }, []);

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

      // Try Telegram auth if available and has valid initData
      if (tg?.initData && tg.initData.length > 0) {
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
          
          // If in production and initData is invalid, show error
          if (!import.meta.env.DEV) {
            alert('Пожалуйста, откройте приложение через Telegram бота @AguGram_Bot');
            setIsAuthenticating(false);
            return;
          }
          // In dev mode, fall through to dev auth
        }
      }
      
      // Dev authentication for development mode OR when opened outside Telegram
      if (import.meta.env.DEV || !tg?.initData) {
        logger.log('[Entry] Using dev authentication (no valid Telegram context)');
        
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
          // In production without Telegram, show message
          if (!import.meta.env.DEV) {
            alert('Пожалуйста, откройте приложение через Telegram бота @AguGram_Bot');
          }
        }
      }
      
      setIsAuthenticating(false);
    } catch (error) {
      logger.error('[Entry] Auth error:', error);
      alert('Произошла ошибка при авторизации. Попробуйте снова.');
      setIsAuthenticating(false);
    }
  };

  // Slider drag handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isAuthenticating) return;
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragMove = useCallback((clientX: number) => {
    if (!isDragging || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newPosition = clientX - containerRect.left - 30; // 30 is half slider width
    const maxPos = getMaxPosition();
    
    setSliderPosition(Math.max(0, Math.min(newPosition, maxPos)));
  }, [isDragging, getMaxPosition]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const maxPos = getMaxPosition();
    const threshold = maxPos * 0.85; // 85% to trigger
    
    if (sliderPosition >= threshold) {
      // Triggered! Animate to end and start auth
      setSliderPosition(maxPos);
      handleStart();
    } else {
      // Snap back to start
      setSliderPosition(0);
    }
  }, [isDragging, sliderPosition, getMaxPosition]);

  // Mouse events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);
    const handleMouseUp = () => handleDragEnd();
    
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Touch events
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      handleDragMove(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => handleDragEnd();

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

  const progress = sliderPosition / (getMaxPosition() || 1);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#0A1A2F] to-black text-white flex items-center justify-center px-4 py-4">
      <div className="w-full max-w-[400px] flex flex-col items-center justify-between min-h-[90vh]">
        {/* Top area with logo and headings */}
        <div className="w-full flex flex-col items-center pt-4">
          {/* Logo image */}
          <div className="w-36 h-36 flex items-center justify-center mb-4">
            <img 
              src={entryLogo} 
              alt="AguGram Logo" 
              className="w-full h-full object-contain rounded-2xl"
            />
          </div>

          <h1 
            className="text-3xl leading-tight text-[#5800EF] text-center font-extrabold mb-2" 
            style={{ fontFamily: 'Raleway' }}
          >
            AguGram
          </h1>
          <h2 
            className="text-lg text-white/80 text-center font-medium px-4" 
            style={{ fontFamily: 'Raleway' }}
          >
            Первая соцсеть для студентов
          </h2>
          <p 
            className="text-base text-white/50 text-center mt-4 px-6" 
            style={{ fontFamily: 'Raleway' }}
          >
            Сообщество, где быть внутри — уже привилегия
          </p>
        </div>

        {/* Bottom area with slider button and created-by */}
        <div className="w-full flex flex-col items-center pb-6">
          {/* Swipe to unlock button */}
          <div 
            ref={containerRef}
            className="w-full max-w-[320px] h-16 relative rounded-full overflow-hidden"
            style={{
              background: 'linear-gradient(90deg, rgba(196,45,255,0.1) 0%, rgba(74,144,255,0.1) 100%)',
            }}
          >
            {/* Gradient border effect */}
            <div 
              className="absolute inset-0 rounded-full p-[1px]" 
              style={{ 
                background: 'linear-gradient(90deg, #C42DFF 0%, #4A90FF 100%)',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
              }}
            />
            
            {/* Progress fill */}
            <div 
              className="absolute inset-0 rounded-full transition-opacity"
              style={{
                background: 'linear-gradient(90deg, rgba(196,45,255,0.3) 0%, rgba(74,144,255,0.3) 100%)',
                opacity: progress,
                width: `${Math.max(sliderPosition + 60, 60)}px`,
              }}
            />
            
            {/* Text label */}
            <div 
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ 
                opacity: 1 - progress * 0.5,
                fontFamily: 'Raleway' 
              }}
            >
              <span className="text-white/70 text-base font-medium ml-8">
                {isAuthenticating ? 'Загрузка...' : 'Slide to Start'}
              </span>
              {/* Arrows */}
              {!isAuthenticating && (
                <div className="flex gap-1 ml-4">
                  {[0.3, 0.5, 0.7].map((opacity, i) => (
                    <svg key={i} className="w-4 h-4" viewBox="0 0 24 24" style={{ opacity }}>
                      <path d="M9 6l6 6-6 6" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ))}
                </div>
              )}
            </div>
            
            {/* Draggable slider circle */}
            <div
              ref={sliderRef}
              className="absolute top-1/2 -translate-y-1/2 w-14 h-14 rounded-full cursor-grab active:cursor-grabbing z-10 flex items-center justify-center shadow-lg"
              style={{
                left: `${sliderPosition + 4}px`,
                background: 'linear-gradient(135deg, #C42DFF 0%, #4A90FF 100%)',
                transition: isDragging ? 'none' : 'left 0.3s ease-out',
                touchAction: 'none',
              }}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {isAuthenticating ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M9 6l6 6-6 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </div>

          <div className="h-6" />

          <div className="flex items-center gap-3 text-sm" style={{ fontFamily: 'Raleway' }}>
            <span className="text-white/30">Created by</span>
            <span className="text-white font-bold blur-[3px] opacity-80">secret</span>
          </div>
        </div>
      </div>
    </div>
  );
}
