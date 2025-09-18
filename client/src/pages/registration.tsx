import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocation } from 'wouter';
import { usernameSchema } from '@shared/schema';
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
  photos: File[];
}

export default function RegistrationPage() {
  const [, setLocation] = useLocation();
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
    photos: []
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = async () => {
    if (!validateStep(1)) return;

    setIsSubmitting(true);
    try {
      // Build social links array
      const socialLinks = [];
      if (formData.telegram.trim()) socialLinks.push(formData.telegram);
      if (formData.instagram.trim()) socialLinks.push(formData.instagram);
      if (formData.vk.trim()) socialLinks.push(formData.vk);

      // For now, we'll submit the basic profile data
      const profileData = {
        displayName: formData.displayName,
        gender: formData.gender,
        course: formData.course,
        direction: formData.direction,
        bio: formData.bio || '',
        socialLinks,
        photos: [] // Will be implemented later with image upload
      };

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileData)
      });

      if (response.ok) {
        setLocation('/');
      } else {
        const errorData = await response.json();
        console.error('Profile update failed:', errorData);
        if (errorData.details) {
          const validationErrors: Record<string, string> = {};
          errorData.details.forEach((issue: any) => {
            if (issue.path && issue.path[0]) {
              validationErrors[issue.path[0]] = issue.message;
            }
          });
          setErrors(validationErrors);
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
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
    <div className="min-h-screen w-full bg-gradient-to-b from-[#0A1A2F] to-black text-white flex items-center justify-center px-6 py-6">
      <div className="w-full max-w-[428px] h-[926px] rounded-3xl flex items-center justify-center px-7 py-7 box-border">
        <div className="w-full max-w-[380px] rounded-[28px] px-5 py-5 pb-7 box-border bg-white/8 backdrop-blur-[18px] shadow-[0_12px_30px_rgba(2,6,23,0.18)] flex flex-col relative">
          {/* Back button */}
          <button
            type="button"
            onClick={prevStep}
            className="absolute top-4 left-4 w-9 h-9 rounded-full border-none bg-white/20 text-white flex items-center justify-center cursor-pointer text-lg leading-none hover:bg-white/30 transition-colors"
            style={{ display: currentStep === 1 ? 'none' : 'flex' }}
          >
            ←
          </button>

          {/* Logo */}
          <div className="w-[92px] h-[34px] flex items-center justify-center mx-auto mt-1.5 mb-2.5">
            <svg width="92" height="34" viewBox="0 0 120 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <text x="50%" y="60%" dominantBaseline="middle" textAnchor="middle" className="font-extrabold fill-white" fontSize="26" fontFamily="Raleway">AguGram</text>
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-[32px] leading-[1.05] font-extrabold text-center mt-1.5 bg-gradient-to-r from-[#C42DFF] to-[#4A90FF] bg-clip-text text-transparent">
            Создать аккаунт
          </h1>
          <div className="text-sm text-gray-300 text-center mt-1.5 font-semibold">{getStepTitle()}</div>

          {/* Progress bar */}
          <div className="flex gap-1.5 mt-3.5 mb-4.5">
            {[...Array(totalSteps)].map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-1.5 rounded-md transition-all ${
                  i < currentStep 
                    ? 'bg-[#5800EF] shadow-[0_0_12px_rgba(88,0,239,0.9)]' 
                    : 'bg-white/10 shadow-[0_0_8px_rgba(88,0,239,0.6)]'
                }`}
              />
            ))}
          </div>

          {/* Form steps */}
          <div className="flex flex-col gap-6 mt-1 relative overflow-hidden">
            {/* Step 1: Personal Information */}
            <motion.div
              className="flex flex-col gap-6"
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
                <Label htmlFor="displayName" className="text-white text-[15px] font-bold mb-2 block">
                  Ваше имя:
                </Label>
                <Input
                  id="displayName"
                  className="w-full h-[54px] rounded-2xl border-none bg-white/12 text-white text-[15px] px-4 placeholder:text-white/50"
                  placeholder="Введите имя"
                  value={formData.displayName}
                  onChange={(e) => updateFormData('displayName', e.target.value)}
                />
                {errors.displayName && (
                  <p className="text-red-400 text-sm mt-1">{errors.displayName}</p>
                )}
              </div>

              <div className="mt-6">
                <Label className="text-white text-[15px] font-bold mb-2 block">
                  Ваш пол:
                </Label>
                <Select value={formData.gender} onValueChange={(value) => updateFormData('gender', value)}>
                  <SelectTrigger className="w-full h-[54px] rounded-2xl border-none bg-white/12 text-white text-[15px] px-4">
                    <SelectValue placeholder="Выберите пол" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Мужской</SelectItem>
                    <SelectItem value="female">Женский</SelectItem>
                  </SelectContent>
                </Select>
                {errors.gender && (
                  <p className="text-red-400 text-sm mt-1">{errors.gender}</p>
                )}
              </div>

              <div className="mt-6">
                <Label className="text-white text-[15px] font-bold mb-2 block">
                  Выберите курс:
                </Label>
                <Select value={formData.course} onValueChange={(value) => updateFormData('course', value)}>
                  <SelectTrigger className="w-full h-[54px] rounded-2xl border-none bg-white/12 text-white text-[15px] px-4">
                    <SelectValue placeholder="Выберите курс" />
                  </SelectTrigger>
                  <SelectContent>
                    {['1', '2', '3', '4', '5', '6'].map(course => (
                      <SelectItem key={course} value={course}>{course} курс</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.course && (
                  <p className="text-red-400 text-sm mt-1">{errors.course}</p>
                )}
              </div>

              <div className="mt-6">
                <Label htmlFor="direction" className="text-white text-[15px] font-bold mb-2 block">
                  Выберите направление:
                </Label>
                <Input
                  id="direction"
                  className="w-full h-[54px] rounded-2xl border-none bg-white/12 text-white text-[15px] px-4 placeholder:text-white/50"
                  placeholder="Например, Программирование"
                  value={formData.direction}
                  onChange={(e) => updateFormData('direction', e.target.value)}
                />
                {errors.direction && (
                  <p className="text-red-400 text-sm mt-1">{errors.direction}</p>
                )}
              </div>

              <div className="mt-6">
                <Label htmlFor="bio" className="text-white text-[15px] font-bold mb-2 block">
                  О себе:
                </Label>
                <Textarea
                  id="bio"
                  className="w-full h-[108px] rounded-2xl border-none bg-white/12 text-white text-[15px] px-4 py-3 resize-none placeholder:text-white/50"
                  placeholder="Напишите немного о себе"
                  value={formData.bio}
                  onChange={(e) => updateFormData('bio', e.target.value)}
                />
              </div>

              <Button
                onClick={nextStep}
                className="mt-4 w-full h-11 rounded-full font-bold text-white bg-gradient-to-r from-[#C42DFF] to-[#4A90FF] border-none shadow-[0_8px_18px_rgba(68,47,255,0.12)] hover:opacity-90 transition-opacity"
              >
                Продолжить
              </Button>
            </motion.div>

            {/* Step 2: Social Links */}
            <motion.div
              className="flex flex-col gap-6"
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
                <Label htmlFor="telegram" className="text-white text-[15px] font-bold mb-2 block">
                  Ссылка на Telegram:
                </Label>
                <Input
                  id="telegram"
                  className="w-full h-[54px] rounded-2xl border-none bg-white/12 text-white text-[15px] px-4 placeholder:text-white/50"
                  placeholder="https://t.me/username"
                  value={formData.telegram}
                  onChange={(e) => updateFormData('telegram', e.target.value)}
                />
              </div>

              <div className="mt-6">
                <Label htmlFor="instagram" className="text-white text-[15px] font-bold mb-2 block">
                  Ссылка на Instagram:
                </Label>
                <Input
                  id="instagram"
                  className="w-full h-[54px] rounded-2xl border-none bg-white/12 text-white text-[15px] px-4 placeholder:text-white/50"
                  placeholder="https://instagram.com/username"
                  value={formData.instagram}
                  onChange={(e) => updateFormData('instagram', e.target.value)}
                />
              </div>

              <div className="mt-6">
                <Label htmlFor="vk" className="text-white text-[15px] font-bold mb-2 block">
                  Ссылка на ВК:
                </Label>
                <Input
                  id="vk"
                  className="w-full h-[54px] rounded-2xl border-none bg-white/12 text-white text-[15px] px-4 placeholder:text-white/50"
                  placeholder="https://vk.com/username"
                  value={formData.vk}
                  onChange={(e) => updateFormData('vk', e.target.value)}
                />
              </div>

              <Button
                onClick={nextStep}
                className="mt-4 w-full h-11 rounded-full font-bold text-white bg-gradient-to-r from-[#C42DFF] to-[#4A90FF] border-none hover:opacity-90 transition-opacity"
              >
                Продолжить
              </Button>

              <Button
                onClick={nextStep}
                variant="outline"
                className="mt-3 w-full h-11 rounded-full font-semibold text-white bg-white/15 border-none hover:bg-white/25 transition-colors"
              >
                Пропустить
              </Button>
            </motion.div>

            {/* Step 3: Photos */}
            <motion.div
              className="flex flex-col gap-6"
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
              {[1, 2, 3].map((photoIndex) => (
                <div key={photoIndex} className="mt-6">
                  <Label className="text-white text-[15px] font-bold mb-2 block">
                    Добавьте фото в профиль:
                  </Label>
                  <Input
                    type="file"
                    accept="image/*"
                    className="w-full h-[54px] rounded-2xl border-none bg-white/12 text-white text-[15px] px-4 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
                  />
                </div>
              ))}

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="mt-4 w-full h-11 rounded-full font-bold text-white bg-gradient-to-r from-[#C42DFF] to-[#4A90FF] border-none hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? 'Создание...' : 'Создать аккаунт'}
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                variant="outline"
                className="mt-3 w-full h-11 rounded-full font-semibold text-white bg-white/15 border-none hover:bg-white/25 transition-colors disabled:opacity-50"
              >
                Пропустить
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}