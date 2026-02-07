import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { logger } from '@/lib/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocation } from 'wouter';
import { usernameSchema } from '@shared/schema';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { z } from 'zod';

interface RegistrationData {
  displayName: string;
  gender: 'male' | 'female' | '';
  course: string;
  direction: string;
  bio: string;
  telegram: string;
  instagram: string;
  vk: string;
  avatarUrl: string;
  photoUrls: string[];
}

// Unified field styles - компактные и современные
const fieldBaseClasses = "w-full h-[48px] rounded-xl border-none bg-white/95 text-gray-900 text-[14px] px-3.5 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5800EF]/50 box-border transition-all";
const textareaClasses = "w-full h-[90px] rounded-xl border-none bg-white/95 text-gray-900 text-[14px] px-3.5 py-2.5 resize-none placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5800EF]/50 box-border transition-all";
const selectTriggerClasses = "w-full h-[48px] rounded-xl border-none bg-white/95 text-gray-900 text-[14px] px-3.5 data-[placeholder]:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5800EF]/50 box-border transition-all";
const fileInputClasses = "w-full h-[48px] rounded-xl border-none bg-white/95 text-gray-900 text-[13px] px-3 focus:outline-none focus:ring-2 focus:ring-[#5800EF]/50 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#5800EF] file:text-white hover:file:bg-[#4A00CC] file:transition-colors cursor-pointer box-border";

export default function RegistrationPage() {
  const [, setLocation] = useLocation();
  const auth = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;
  const [formData, setFormData] = useState<RegistrationData>({
    displayName: '',
    gender: '',
    course: '',
    direction: '',
    bio: '',
    telegram: '',
    instagram: '',
    vk: '',
    avatarUrl: '',
    photoUrls: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // Log auth status on mount
  useEffect(() => {
    logger.log('[Registration] Component mounted');
    logger.log('[Registration] Auth status:', {
      hasUser: !!auth.user,
      hasToken: !!auth.token,
      user: auth.user?.anonName
    });
  }, []);

  const updateFormData = (field: keyof RegistrationData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateStep = (step: number): boolean => {
    const stepErrors: Record<string, string> = {};

    if (step === 1) {
      // Validate display name
      try {
        usernameSchema.parse(formData.displayName);
      } catch (error) {
        if (error instanceof z.ZodError) {
          stepErrors.displayName = error.issues[0]?.message || 'Неверное имя пользователя';
        }
      }

      if (!formData.gender) {
        stepErrors.gender = 'Пол обязателен';
      }

      if (!formData.course) {
        stepErrors.course = 'Курс обязателен';
      }

      if (!formData.direction.trim()) {
        stepErrors.direction = 'Направление обязательно';
      }
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(prev => prev + 1);
      } else {
        handleSubmit();
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    if (!username.trim()) return false;
    
    try {
      const response = await apiRequest('GET', `/api/check-username/${encodeURIComponent(username.toLowerCase())}`);
      const data = await response.json();
      return data.available;
    } catch (error) {
      logger.error('Username check failed:', error);
      return false;
    }
  };

  const handleUsernameBlur = async () => {
    if (!formData.displayName.trim()) return;
    
    // Validate format first
    try {
      usernameSchema.parse(formData.displayName);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({ ...prev, displayName: error.issues[0]?.message || 'Неверное имя пользователя' }));
      }
      return;
    }

    setIsCheckingUsername(true);
    const isAvailable = await checkUsernameAvailability(formData.displayName);
    if (!isAvailable) {
      setErrors(prev => ({ ...prev, displayName: 'Имя пользователя уже занято' }));
    }
    setIsCheckingUsername(false);
  };

  const handleFileUpload = async (file: File, type: 'avatar' | 'photo'): Promise<string | null> => {
    try {
      setIsUploading(true);
      setUploadProgress(`Загрузка ${type === 'avatar' ? 'аватара' : 'фото'}...`);

      const formData = new FormData();
      if (type === 'avatar') {
        formData.append('image', file);
      } else {
        formData.append('images', file);
      }

      const endpoint = type === 'avatar' ? '/api/upload/image' : '/api/upload/images';
      const response = await apiRequest('POST', endpoint, formData, true); // true for FormData

      if (response.ok) {
        const data = await response.json();
        setUploadProgress('');
        return type === 'avatar' ? data.url : (data.urls && data.urls[0]) || null;
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      logger.error('File upload error:', error);
      setErrors(prev => ({ ...prev, upload: 'Не удалось загрузить файл' }));
      return null;
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, avatar: 'Файл слишком большой. Максимум 5MB' }));
      return;
    }

    const url = await handleFileUpload(file, 'avatar');
    if (url) {
      updateFormData('avatarUrl', url);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, [`photo${index}`]: 'Файл слишком большой. Максимум 5MB' }));
      return;
    }

    const url = await handleFileUpload(file, 'photo');
    if (url) {
      const newPhotoUrls = [...formData.photoUrls];
      newPhotoUrls[index] = url;
      updateFormData('photoUrls', newPhotoUrls);
    }
  };

  const handleSubmit = async () => {
    // Validate step 1 data (required fields)
    if (!validateStep(1)) {
      // If validation fails, go back to step 1
      setCurrentStep(1);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    try {
      logger.log('[Registration] Starting submission...');
      
      // Check username uniqueness first
      const isAvailable = await checkUsernameAvailability(formData.displayName);
      if (!isAvailable) {
        setErrors({ displayName: 'Имя пользователя уже занято' });
        setCurrentStep(1); // Go back to step 1
        setIsSubmitting(false);
        return;
      }

      // Build social links array
      const socialLinks = [];
      if (formData.telegram.trim()) socialLinks.push(formData.telegram);
      if (formData.instagram.trim()) socialLinks.push(formData.instagram);
      if (formData.vk.trim()) socialLinks.push(formData.vk);

      // Build profile data with uploaded images
      const profileData = {
        displayName: formData.displayName.toLowerCase(), // Store as lowercase for consistency
        gender: formData.gender,
        course: formData.course,
        direction: formData.direction,
        bio: formData.bio || '',
        socialLinks,
        avatarUrl: formData.avatarUrl || '',
        photos: formData.photoUrls.filter(url => url.trim() !== '')
      };

      logger.log('[Registration] Sending profile data:', profileData);
      const response = await apiRequest('PATCH', '/api/profile', profileData);

      if (response.ok) {
        logger.log('[Registration] Success! Redirecting to home...');
        const data = await response.json();
        logger.log('[Registration] Profile created:', data);
        
        // Small delay to ensure state is saved
        setTimeout(() => {
          setLocation('/');
        }, 100);
      } else {
        const errorData = await response.json();
        logger.error('[Registration] Profile update failed:', errorData);
        
        // Check if it's an authentication error
        if (response.status === 401) {
          logger.error('[Registration] Auth token expired or invalid');
          auth.clearAuth();
          setErrors({ submit: 'Сессия истекла. Пожалуйста, начните заново.' });
          setTimeout(() => {
            setLocation('/entry');
          }, 2000);
          return;
        }
        
        if (errorData.details) {
          const validationErrors: Record<string, string> = {};
          errorData.details.forEach((issue: any) => {
            if (issue.path && issue.path[0]) {
              validationErrors[issue.path[0]] = issue.message;
            }
          });
          setErrors(validationErrors);
          setCurrentStep(1); // Go back to first step with errors
        } else {
          // Show generic error
          setErrors({ submit: errorData.error || errorData.message || 'Не удалось создать профиль' });
        }
      }
    } catch (error) {
      logger.error('[Registration] Registration error:', error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setErrors({ submit: 'Ошибка соединения с сервером. Проверьте подключение к интернету.' });
      } else {
        setErrors({ submit: 'Произошла ошибка. Попробуйте снова.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStepTitle = () => {
    switch (currentStep) {
      case 1: return 'Шаг 1 из 3: Личная информация';
      case 2: return 'Шаг 2 из 3: Социальные сети';
      case 3: return 'Шаг 3 из 3: Фотографии';
      default: return 'Регистрация';
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#0A1A2F] to-black text-white flex items-center justify-center px-5 py-6">
      <div className="w-full max-w-[428px] min-h-[926px] rounded-3xl flex items-center justify-center px-6 py-6 box-border">
        <div className="w-full max-w-[390px] rounded-3xl px-6 py-6 box-border bg-white/8 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] flex flex-col relative border border-white/10">
          {/* Back button */}
          <button
            type="button"
            onClick={prevStep}
            className="absolute top-5 left-5 w-8 h-8 rounded-full border-none bg-white/15 text-white flex items-center justify-center cursor-pointer text-base leading-none hover:bg-white/25 transition-all backdrop-blur-sm"
            style={{ display: currentStep === 1 ? 'none' : 'flex' }}
          >
            ←
          </button>

          {/* Logo */}
          <div className="w-20 h-8 flex items-center justify-center mx-auto mt-0 mb-3">
            <svg width="80" height="32" viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" style={{ fontFamily: 'Raleway', fontWeight: 800, fill: 'white' }} fontSize="24">AguGram</text>
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-[28px] leading-[1.1] font-extrabold text-center mt-0 mb-1 bg-gradient-to-r from-[#C42DFF] to-[#4A90FF] bg-clip-text text-transparent" style={{ fontFamily: 'Raleway' }}>
            Создать аккаунт
          </h1>
          <div className="text-[13px] text-gray-300 text-center mt-0 mb-4 font-medium" style={{ fontFamily: 'Raleway' }}>{getStepTitle()}</div>

          {/* Progress bar */}
          <div className="flex gap-2 mt-0 mb-5">
            {[...Array(totalSteps)].map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                  i < currentStep 
                    ? 'bg-gradient-to-r from-[#C42DFF] to-[#4A90FF] shadow-[0_0_8px_rgba(88,0,239,0.6)]' 
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* Form steps */}
          <div className="flex flex-col gap-3 mt-1 relative overflow-hidden">
            {/* Step 1: Personal Information */}
            <motion.div
              className="flex flex-col gap-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ 
                opacity: currentStep === 1 ? 1 : 0, 
                x: currentStep === 1 ? 0 : 20,
                position: currentStep === 1 ? 'relative' : 'absolute',
                width: '100%'
              }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              style={{ display: currentStep === 1 ? 'flex' : 'none' }}
            >
              <div>
                <Label htmlFor="displayName" className="text-white text-[13px] font-semibold mb-1.5 block" style={{ fontFamily: 'Raleway' }}>
                  Ваше имя
                </Label>
                <Input
                  id="displayName"
                  className={fieldBaseClasses}
                  placeholder="Введите имя"
                  value={formData.displayName}
                  onChange={(e) => updateFormData('displayName', e.target.value)}
                  onBlur={handleUsernameBlur}
                  disabled={isCheckingUsername}
                />
                {errors.displayName && (
                  <p className="text-red-400 text-xs mt-1">{errors.displayName}</p>
                )}
                {isCheckingUsername && (
                  <p className="text-blue-400 text-xs mt-1">Проверка...</p>
                )}
              </div>

              <div className="mt-2.5">
                <Label className="text-white text-[13px] font-semibold mb-1.5 block" style={{ fontFamily: 'Raleway' }}>
                  Пол
                </Label>
                <Select value={formData.gender} onValueChange={(value) => updateFormData('gender', value)}>
                  <SelectTrigger className={selectTriggerClasses}>
                    <SelectValue placeholder="Выберите" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 rounded-xl">
                    <SelectItem value="male" className="text-gray-900 focus:bg-purple-50">Мужской</SelectItem>
                    <SelectItem value="female" className="text-gray-900 focus:bg-purple-50">Женский</SelectItem>
                  </SelectContent>
                </Select>
                {errors.gender && (
                  <p className="text-red-400 text-xs mt-1">{errors.gender}</p>
                )}
              </div>

              <div className="mt-2.5">
                <Label className="text-white text-[13px] font-semibold mb-1.5 block" style={{ fontFamily: 'Raleway' }}>
                  Курс
                </Label>
                <Select value={formData.course} onValueChange={(value) => updateFormData('course', value)}>
                  <SelectTrigger className={selectTriggerClasses}>
                    <SelectValue placeholder="Выберите" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 rounded-xl">
                    {['1', '2', '3', '4', '5', '6'].map(course => (
                      <SelectItem key={course} value={course} className="text-gray-900 focus:bg-purple-50">{course} курс</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.course && (
                  <p className="text-red-400 text-xs mt-1">{errors.course}</p>
                )}
              </div>

              <div className="mt-2.5">
                <Label htmlFor="direction" className="text-white text-[13px] font-semibold mb-1.5 block" style={{ fontFamily: 'Raleway' }}>
                  Направление
                </Label>
                <Input
                  id="direction"
                  className={fieldBaseClasses}
                  placeholder="Например, Программирование"
                  value={formData.direction}
                  onChange={(e) => updateFormData('direction', e.target.value)}
                />
                {errors.direction && (
                  <p className="text-red-400 text-xs mt-1">{errors.direction}</p>
                )}
              </div>

              <div className="mt-2.5">
                <Label htmlFor="bio" className="text-white text-[13px] font-semibold mb-1.5 block" style={{ fontFamily: 'Raleway' }}>
                  О себе (необязательно)
                </Label>
                <Textarea
                  id="bio"
                  className={textareaClasses}
                  placeholder="Расскажите о себе"
                  value={formData.bio}
                  onChange={(e) => updateFormData('bio', e.target.value)}
                />
              </div>

              <Button
                onClick={nextStep}
                className="mt-5 w-full h-11 rounded-xl font-semibold text-white bg-gradient-to-r from-[#C42DFF] to-[#4A90FF] border-none hover:opacity-90 transition-all"
                style={{ fontFamily: 'Raleway' }}
              >
                Продолжить
              </Button>
            </motion.div>

            {/* Step 2: Social Links */}
            <motion.div
              className="flex flex-col gap-2.5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ 
                opacity: currentStep === 2 ? 1 : 0, 
                x: currentStep === 2 ? 0 : 20,
                position: currentStep === 2 ? 'relative' : 'absolute',
                width: '100%'
              }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              style={{ display: currentStep === 2 ? 'flex' : 'none' }}
            >
              <div>
                <Label htmlFor="telegram" className="text-white text-[13px] font-semibold mb-1.5 block" style={{ fontFamily: 'Raleway' }}>
                  Telegram (необязательно)
                </Label>
                <Input
                  id="telegram"
                  className={fieldBaseClasses}
                  placeholder="https://t.me/username"
                  value={formData.telegram}
                  onChange={(e) => updateFormData('telegram', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="instagram" className="text-white text-[13px] font-semibold mb-1.5 block" style={{ fontFamily: 'Raleway' }}>
                  Instagram (необязательно)
                </Label>
                <Input
                  id="instagram"
                  className={fieldBaseClasses}
                  placeholder="https://instagram.com/username"
                  value={formData.instagram}
                  onChange={(e) => updateFormData('instagram', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="vk" className="text-white text-[13px] font-semibold mb-1.5 block" style={{ fontFamily: 'Raleway' }}>
                  ВКонтакте (необязательно)
                </Label>
                <Input
                  id="vk"
                  className={fieldBaseClasses}
                  placeholder="https://vk.com/username"
                  value={formData.vk}
                  onChange={(e) => updateFormData('vk', e.target.value)}
                />
              </div>

              <Button
                onClick={nextStep}
                className="mt-4 w-full h-11 rounded-xl font-semibold text-white bg-gradient-to-r from-[#C42DFF] to-[#4A90FF] border-none hover:opacity-90 transition-all"
                style={{ fontFamily: 'Raleway' }}
              >
                Продолжить
              </Button>

              <Button
                onClick={nextStep}
                variant="outline"
                className="mt-2 w-full h-10 rounded-xl font-medium text-white bg-white/10 border-none hover:bg-white/20 transition-all"
                style={{ fontFamily: 'Raleway' }}
              >
                Пропустить
              </Button>
            </motion.div>

            {/* Step 3: Photos */}
            <motion.div
              className="flex flex-col gap-2.5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ 
                opacity: currentStep === 3 ? 1 : 0, 
                x: currentStep === 3 ? 0 : 20,
                position: currentStep === 3 ? 'relative' : 'absolute',
                width: '100%'
              }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              style={{ display: currentStep === 3 ? 'flex' : 'none' }}
            >
              {/* Avatar upload */}
              <div>
                <Label className="text-white text-[13px] font-semibold mb-1.5 block" style={{ fontFamily: 'Raleway' }}>
                  Аватар (необязательно)
                </Label>
                {formData.avatarUrl ? (
                  <div className="relative w-full h-28 rounded-xl overflow-hidden bg-white/10">
                    <img 
                      src={formData.avatarUrl} 
                      alt="Avatar preview" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => updateFormData('avatarUrl', '')}
                      className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:bg-red-600 transition-all backdrop-blur-sm"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    disabled={isUploading}
                    className={fileInputClasses}
                  />
                )}
                {errors.avatar && (
                  <p className="text-red-400 text-xs mt-1">{errors.avatar}</p>
                )}
              </div>

              {/* Photo uploads */}
              {[0, 1, 2].map((photoIndex) => (
                <div key={photoIndex}>
                  <Label className="text-white text-[13px] font-semibold mb-1.5 block" style={{ fontFamily: 'Raleway' }}>
                    Фото {photoIndex + 1} (необязательно)
                  </Label>
                  {formData.photoUrls[photoIndex] ? (
                    <div className="relative w-full h-28 rounded-xl overflow-hidden bg-white/10">
                      <img 
                        src={formData.photoUrls[photoIndex]} 
                        alt={`Photo ${photoIndex + 1} preview`} 
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newUrls = [...formData.photoUrls];
                          newUrls[photoIndex] = '';
                          updateFormData('photoUrls', newUrls);
                        }}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-500/90 text-white flex items-center justify-center hover:bg-red-600 transition-all backdrop-blur-sm"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handlePhotoChange(e, photoIndex)}
                      disabled={isUploading}
                      className={fileInputClasses}
                    />
                  )}
                  {errors[`photo${photoIndex}`] && (
                    <p className="text-red-400 text-xs mt-1">{errors[`photo${photoIndex}`]}</p>
                  )}
                </div>
              ))}

              {uploadProgress && (
                <p className="text-blue-400 text-xs text-center mt-2">{uploadProgress}</p>
              )}

              {errors.upload && (
                <p className="text-red-400 text-xs text-center mt-2">{errors.upload}</p>
              )}

              {errors.submit && (
                <p className="text-red-400 text-xs text-center mt-2 font-medium">{errors.submit}</p>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || isUploading}
                className="mt-4 w-full h-11 rounded-xl font-semibold text-white bg-gradient-to-r from-[#C42DFF] to-[#4A90FF] border-none hover:opacity-90 transition-all disabled:opacity-50"
                style={{ fontFamily: 'Raleway' }}
              >
                {isSubmitting ? 'Создание...' : 'Создать аккаунт'}
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || isUploading}
                variant="outline"
                className="mt-2 w-full h-10 rounded-xl font-medium text-white bg-white/10 border-none hover:bg-white/20 transition-all disabled:opacity-50"
                style={{ fontFamily: 'Raleway' }}
              >
                {isSubmitting ? 'Создание...' : 'Пропустить'}
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}