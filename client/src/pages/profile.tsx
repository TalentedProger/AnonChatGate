import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { User, Book, Globe, Image } from 'lucide-react';

interface UserProfile {
  id: number;
  telegramId: string;
  anonName: string;
  status: string;
  displayName?: string;
  course?: string;
  direction?: string;
  bio?: string;
  avatarUrl?: string;
  socialLinks?: string[];
  photos?: string[];
}

export default function ProfilePage() {
  const auth = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    course: '',
    direction: '',
    bio: '',
    avatarUrl: '',
    socialLinks: '',
    photos: ''
  });

  // Fetch user profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['/api/profile'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/profile');
      return await response.json() as UserProfile;
    },
    enabled: !!auth.user && !!auth.token
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PATCH', '/api/profile', {
        displayName: data.displayName,
        course: data.course,
        direction: data.direction,
        bio: data.bio || undefined,
        avatarUrl: data.avatarUrl || undefined,
        socialLinks: data.socialLinks ? data.socialLinks.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        photos: data.photos ? data.photos.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      setIsEditing(false);
      toast({
        title: "Профиль обновлен",
        description: "Ваши данные успешно сохранены"
      });
    },
    onError: (error: any) => {
      console.error('Profile update error:', error);
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: "Не удалось обновить профиль"
      });
    }
  });

  // Initialize form when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        course: profile.course || '',
        direction: profile.direction || '',
        bio: profile.bio || '',
        avatarUrl: profile.avatarUrl || '',
        socialLinks: profile.socialLinks?.join(', ') || '',
        photos: profile.photos?.join(', ') || ''
      });
    }
  }, [profile]);

  const handleEdit = () => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        course: profile.course || '',
        direction: profile.direction || '',
        bio: profile.bio || '',
        avatarUrl: profile.avatarUrl || '',
        socialLinks: profile.socialLinks?.join(', ') || '',
        photos: profile.photos?.join(', ') || ''
      });
    }
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!formData.displayName.trim() || !formData.course.trim() || !formData.direction.trim()) {
      toast({
        variant: "destructive",
        title: "Ошибка валидации",
        description: "Имя, курс и направление обязательны для заполнения"
      });
      return;
    }
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        course: profile.course || '',
        direction: profile.direction || '',
        bio: profile.bio || '',
        avatarUrl: profile.avatarUrl || '',
        socialLinks: profile.socialLinks?.join(', ') || '',
        photos: profile.photos?.join(', ') || ''
      });
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background p-4 space-y-4 overflow-y-auto pb-20">
      <div className="glass-effect neon-border rounded-lg">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center neon-glow">
              <User size={20} className="text-primary-foreground" />
            </div>
            <h1 className="text-xl font-semibold text-primary neon-text">Профиль пользователя</h1>
          </div>
          {/* Anonymous Identity */}
          <div className="glass-effect border border-primary/30 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-accent mb-2">Анонимное имя в чатах</h3>
            <p className="text-lg font-mono text-primary neon-text">{auth.user?.anonName}</p>
            <p className="text-xs text-accent/60">ID: {auth.user?.id}</p>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-primary to-transparent mb-6"></div>

          {/* Profile Form */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-accent neon-text">Личная информация</h3>
              {!isEditing && (
                <button
                  onClick={handleEdit}
                  className="glass-effect border border-primary/50 text-primary px-4 py-2 rounded-lg hover:neon-glow transition-all duration-300"
                  data-testid="button-edit-profile"
                >
                  Редактировать
                </button>
              )}
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <label htmlFor="displayName" className="text-accent/80 text-sm font-medium">Имя *</label>
              {isEditing ? (
                <input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="Ваше имя"
                  className="w-full glass-effect border border-primary/30 rounded-lg px-4 py-2 text-foreground placeholder-accent/60 focus:outline-none focus:border-primary focus:neon-glow transition-all duration-300"
                  data-testid="input-display-name"
                />
              ) : (
                <p className="text-sm p-3 glass-effect border border-primary/20 rounded-lg">
                  {profile?.displayName || 'Не указано'}
                </p>
              )}
            </div>

            {/* Course */}
            <div className="space-y-2">
              <Label htmlFor="course">Курс *</Label>
              {isEditing ? (
                <Input
                  id="course"
                  value={formData.course}
                  onChange={(e) => setFormData(prev => ({ ...prev, course: e.target.value }))}
                  placeholder="Например: 2 курс"
                  data-testid="input-course"
                />
              ) : (
                <p className="text-sm p-2 bg-muted/30 rounded flex items-center gap-2">
                  <Book size={16} />
                  {profile?.course || 'Не указано'}
                </p>
              )}
            </div>

            {/* Direction */}
            <div className="space-y-2">
              <Label htmlFor="direction">Направление *</Label>
              {isEditing ? (
                <Input
                  id="direction"
                  value={formData.direction}
                  onChange={(e) => setFormData(prev => ({ ...prev, direction: e.target.value }))}
                  placeholder="Например: Программная инженерия"
                  data-testid="input-direction"
                />
              ) : (
                <p className="text-sm p-2 bg-muted/30 rounded flex items-center gap-2">
                  <Globe size={16} />
                  {profile?.direction || 'Не указано'}
                </p>
              )}
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">О себе</Label>
              {isEditing ? (
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  placeholder="Расскажите о себе..."
                  rows={3}
                  data-testid="input-bio"
                />
              ) : (
                <p className="text-sm p-2 bg-muted/30 rounded min-h-[60px]">
                  {profile?.bio || 'Не указано'}
                </p>
              )}
            </div>

            {/* Avatar URL */}
            <div className="space-y-2">
              <Label htmlFor="avatarUrl">Аватар (URL)</Label>
              {isEditing ? (
                <Input
                  id="avatarUrl"
                  value={formData.avatarUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, avatarUrl: e.target.value }))}
                  placeholder="https://example.com/avatar.jpg"
                  data-testid="input-avatar-url"
                />
              ) : (
                <div className="flex items-center gap-3 p-2 bg-muted/30 rounded">
                  {profile?.avatarUrl ? (
                    <>
                      <img
                        src={profile.avatarUrl}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <span className="text-sm truncate">{profile.avatarUrl}</span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">Не указано</span>
                  )}
                </div>
              )}
            </div>

            {/* Social Links */}
            <div className="space-y-2">
              <Label htmlFor="socialLinks">Социальные ссылки</Label>
              {isEditing ? (
                <Input
                  id="socialLinks"
                  value={formData.socialLinks}
                  onChange={(e) => setFormData(prev => ({ ...prev, socialLinks: e.target.value }))}
                  placeholder="https://vk.com/id, https://t.me/username (через запятую)"
                  data-testid="input-social-links"
                />
              ) : (
                <div className="space-y-1">
                  {profile?.socialLinks && profile.socialLinks.length > 0 ? (
                    profile.socialLinks.map((link, index) => (
                      <p key={index} className="text-sm p-1 bg-muted/30 rounded truncate">
                        {link}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm p-2 bg-muted/30 rounded text-muted-foreground">
                      Не указано
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Photos */}
            <div className="space-y-2">
              <Label htmlFor="photos">Фотографии (URL)</Label>
              {isEditing ? (
                <Input
                  id="photos"
                  value={formData.photos}
                  onChange={(e) => setFormData(prev => ({ ...prev, photos: e.target.value }))}
                  placeholder="https://example.com/photo1.jpg, https://example.com/photo2.jpg (через запятую)"
                  data-testid="input-photos"
                />
              ) : (
                <div className="space-y-2">
                  {profile?.photos && profile.photos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {profile.photos.map((photo, index) => (
                        <img
                          key={index}
                          src={photo}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-20 object-cover rounded border"
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm p-2 bg-muted/30 rounded text-muted-foreground flex items-center gap-2">
                      <Image size={16} />
                      Не указано
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {isEditing && (
              <div className="flex gap-3 pt-6">
                <button
                  onClick={handleSave}
                  disabled={updateProfileMutation.isPending}
                  className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-6 py-2 rounded-lg hover:neon-glow transition-all duration-300 disabled:opacity-50"
                  data-testid="button-save-profile"
                >
                  {updateProfileMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={updateProfileMutation.isPending}
                  className="glass-effect border border-accent/50 text-accent px-6 py-2 rounded-lg hover:border-accent hover:neon-glow transition-all duration-300 disabled:opacity-50"
                  data-testid="button-cancel-edit"
                >
                  Отмена
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}