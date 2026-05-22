import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface ClientAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (client: any) => void;
  defaultMode?: 'login' | 'register';
}

export function ClientAuthModal({ isOpen, onClose, onSuccess, defaultMode = 'login' }: ClientAuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [role, setRole] = useState<'client' | 'owner' | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [identifier, setIdentifier] = useState(''); // For login
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setMode(defaultMode);
      // For login, default to client if not set
      if (defaultMode === 'login' && !role) {
        setRole('client');
      }
    }
  }, [isOpen, defaultMode]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register' && !role) {
      toast.error('Пожалуйста, выберите тип аккаунта');
      return;
    }
    
    setIsLoading(true);
    
    const endpoint = mode === 'login' 
      ? '/api/auth/login'
      : '/api/auth/register';
    
    const payload = mode === 'login'
      ? { identifier, password, role: role || 'client' }
      : { role, email, phone, password, name };
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      console.log('Auth response data:', data);
      
      if (!response.ok) {
        toast.error(data.error || 'Ошибка авторизации');
        return;
      }
      
      const user = data.user || data.client;
      console.log('User object from response:', user);
      
      // Определяем роль на основе данных от сервера, а не только состояния модалки
      const finalRole = user.role || (role === 'owner' ? 'owner' : 'client');
      console.log('Final determined role:', finalRole);
      
      // Сохранить токен в зависимости от реальной роли
      if (finalRole === 'owner') {
        console.log('Storing ownerToken');
        localStorage.setItem('ownerToken', data.token);
        localStorage.removeItem('clientToken');
      } else {
        console.log('Storing clientToken');
        localStorage.setItem('clientToken', data.token);
        localStorage.removeItem('ownerToken');
      }
      
      localStorage.setItem('userRole', finalRole);
      
      toast.success(data.message || 'Успешно!');
      onSuccess(user);
      onClose();
    } catch (error) {
      toast.error('Ошибка сервера');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setRole(null);
    setEmail('');
    setPhone('');
    setIdentifier('');
    setPassword('');
    setName('');
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={() => { onClose(); resetForm(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[425px] rounded-3xl max-h-[95vh] overflow-y-auto overflow-x-hidden p-0 mx-auto border-slate-200">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              {mode === 'login' ? 'Вход в систему' : 'Регистрация'}
            </DialogTitle>
          </DialogHeader>
          
          {mode === 'register' && !role ? (
          <div className="space-y-4 py-6">
            <p className="text-center text-slate-600 mb-6">Выберите тип аккаунта для продолжения</p>
            <div className="grid grid-cols-1 gap-4">
              <Button 
                variant="outline" 
                className="h-24 flex flex-col gap-2 rounded-2xl border-2 hover:border-blue-600 hover:bg-blue-50 transition-all"
                onClick={() => setRole('client')}
              >
                <span className="text-2xl">👤</span>
                <div className="text-center">
                  <p className="font-bold">Я клиент</p>
                  <p className="text-xs text-slate-500">Хочу записываться на услуги</p>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="h-24 flex flex-col gap-2 rounded-2xl border-2 hover:border-blue-600 hover:bg-blue-50 transition-all"
                onClick={() => setRole('owner')}
              >
                <span className="text-2xl">💼</span>
                <div className="text-center">
                  <p className="font-bold">Я бизнес</p>
                  <p className="text-xs text-slate-500">Хочу управлять записями и клиентами</p>
                </div>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {mode === 'register' && (
              <div className="flex items-center gap-2 mb-4 p-2 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xl">{role === 'owner' ? '💼' : '👤'}</span>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase text-slate-400">Тип аккаунта</p>
                  <p className="text-sm font-semibold">{role === 'owner' ? 'Бизнес (Владелец)' : 'Клиент'}</p>
                </div>
                <Button variant="ghost" size="sm" className="text-xs text-blue-600" onClick={() => setRole(null)}>
                  Изменить
                </Button>
              </div>
            )}

            {mode === 'login' && (
               <div className="hidden">
                 {/* Role selection moved inside the login block for better flow */}
               </div>
            )}

            {mode === 'login' ? (
              <div className="space-y-4">
                <div className="flex justify-center gap-2 mb-2">
                  <Button 
                    type="button"
                    variant={role === 'client' ? 'default' : 'outline'} 
                    size="sm" 
                    className="rounded-full px-6 h-8 text-xs"
                    onClick={() => setRole('client')}
                  >
                    Я клиент
                  </Button>
                  <Button 
                    type="button"
                    variant={role === 'owner' ? 'default' : 'outline'} 
                    size="sm" 
                    className="rounded-full px-6 h-8 text-xs"
                    onClick={() => setRole('owner')}
                  >
                    Я бизнес
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auth-identifier">Email или Номер телефона</Label>
                  <Input
                    id="auth-identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={role === 'owner' ? 'example@mail.com' : '+7 999 123-45-67'}
                    required
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="auth-email">Email</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@mail.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auth-phone">Номер телефона</Label>
                  <Input
                    id="auth-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7 999 123-45-67"
                    required
                  />
                </div>
              </>
            )}
            
            {mode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="auth-name">
                  {role === 'owner' ? 'Название компании или имя' : 'Ваше имя'}
                </Label>
                <Input
                  id="auth-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={role === 'owner' ? 'Студия красоты "Блеск"' : 'Иван'}
                  required
                />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="auth-password">Пароль</Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            
            <Button type="submit" className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700" disabled={isLoading}>
              {isLoading ? 'Загрузка...' : (mode === 'login' ? 'Войти' : 'Создать аккаунт')}
            </Button>
          </form>
        )}
        
        <div className="text-center text-sm mt-4">
          {mode === 'login' ? (
            <p className="text-slate-500">
              Нет аккаунта?{' '}
              <button 
                type="button"
                className="text-blue-600 font-semibold hover:underline"
                onClick={() => { setMode('register'); setRole(null); }}
              >
                Зарегистрироваться
              </button>
            </p>
          ) : (
            <p className="text-slate-500">
              Уже есть аккаунт?{' '}
              <button
                type="button"
                className="text-blue-600 font-semibold hover:underline"
                onClick={() => { setMode('login'); setRole('client'); }}
              >
                Войти
              </button>
            </p>
          )}
        </div>
      </div>
    </DialogContent>
  </Dialog>
  );
}
