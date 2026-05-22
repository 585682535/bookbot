import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import axios from 'axios';

export default function BusinessSetup() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();
  const token = localStorage.getItem('ownerToken');

  React.useEffect(() => {
    const checkExisting = async () => {
      if (!token) {
        console.log('BusinessSetup: No token found, staying on setup page');
        setIsChecking(false);
        return;
      }
      try {
        console.log('BusinessSetup: Checking for existing business with token:', token.substring(0, 15) + '...');
        const res = await axios.get('/api/businesses/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('BusinessSetup: API response:', JSON.stringify(res.data));
        if (res.data && res.data.slug) {
          console.log('Business already exists, redirecting from setup to dashboard:', res.data.slug);
          navigate(`/dashboard/${res.data.slug}`);
        } else {
          console.log('BusinessSetup: No business found for this user (res.data.slug missing). Data:', JSON.stringify(res.data));
          setIsChecking(false);
        }
      } catch (e: any) {
        console.log('BusinessSetup: Error checking business:', {
          status: e.response?.status,
          data: e.response?.data,
          message: e.message
        });
        setIsChecking(false);
      }
    };
    checkExisting();
  }, [token, navigate]);

  React.useEffect(() => {
    if (!token) {
      navigate('/');
    }
  }, [token, navigate]);

  const transliterate = (text: string) => {
    const map: { [key: string]: string } = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
      'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
      'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
      'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };
    return text.toLowerCase().split('').map(char => map[char] || char).join('')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) {
      toast.error('Пожалуйста, заполните все поля');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post('/api/businesses', {
        name,
        slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, '-')
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Бизнес успешно создан!');
      // Если сервер вернул уже существующий бизнес, мы все равно идем в onboarding или dashboard
      if (response.data.isPublished && response.data.address) {
        navigate(`/dashboard/${response.data.slug}`);
      } else {
        navigate('/onboarding');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при создании бизнеса');
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 font-medium">Проверка данных...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-3xl shadow-xl border-none">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4">
            B
          </div>
          <CardTitle className="text-2xl font-bold">Настройка бизнеса</CardTitle>
          <CardDescription>
            Создайте свой первый бизнес, чтобы начать принимать записи
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="biz-name">Название бизнеса</Label>
              <Input
                id="biz-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug || slug === transliterate(name)) {
                    setSlug(transliterate(e.target.value));
                  }
                }}
                placeholder="Например: Студия красоты 'Блеск'"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-slug">Уникальный ID (для ссылки)</Label>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">bookbot.ru/book/</span>
                <Input
                  id="biz-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="my-studio"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Только латинские буквы, цифры и дефис
              </p>
            </div>
            <Button 
              type="submit" 
              className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
            >
              {isLoading ? 'Создание...' : 'Начать работу'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
