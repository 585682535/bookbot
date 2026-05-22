import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ClientAuthModal } from '@/components/ClientAuthModal';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null);
  const navigate = useNavigate();
  const ownerToken = localStorage.getItem('ownerToken');
  const clientToken = localStorage.getItem('clientToken');
  const userRole = localStorage.getItem('userRole');

  const handleDashboardClick = () => {
    if (userRole === 'owner') {
      navigate('/dashboard');
    } else {
      navigate('/profile');
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Hero Section */}
      <header className="container mx-auto px-4 py-10 md:py-20 text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 md:mb-6 text-slate-900 tracking-tight">
          BookBot — Онлайн-запись без звонков
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 md:mb-8 max-w-2xl mx-auto">
          Современная система записи для вашего бизнеса. Клиенты записываются сами,
          вы получаете больше времени и меньше пропущенных визитов.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 h-14 px-8 text-lg rounded-2xl w-full sm:w-auto" onClick={() => setAuthModal('register')}>
            Создать новый аккаунт
          </Button>
          <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-2xl w-full sm:w-auto" onClick={() => navigate('/map')}>
            🗺️ Найти заведение
          </Button>
          <Button size="lg" variant="ghost" className="h-14 px-8 text-lg rounded-2xl w-full sm:w-auto" onClick={() => setAuthModal('login')}>
            Войти
          </Button>
        </div>
      </header>
      
      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-12 text-slate-900">
          Почему BookBot?
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon="📅"
            title="Онлайн-запись 24/7"
            description="Клиенты записываются в любое время без звонков и ожидания"
          />
          <FeatureCard
            icon="🔔"
            title="Автоматические напоминания"
            description="SMS, Telegram и Push-уведомления снижают no-show на 60%"
          />
          <FeatureCard
            icon="📊"
            title="Аналитика и CRM"
            description="Полная статистика, история клиентов и управление записями"
          />
          <FeatureCard
            icon="💳"
            title="Онлайн-оплата"
            description="Предоплата гарантирует приход клиента"
          />
          <FeatureCard
            icon="🎁"
            title="Промокоды и абонементы"
            description="Гибкая система скидок и лояльности"
          />
          <FeatureCard
            icon="🗺️"
            title="Маркетплейс"
            description="Новые клиенты находят вас на карте BookBot"
          />
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="bg-blue-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Готовы начать?
          </h2>
          <p className="text-lg opacity-90 mb-8">
            Регистрация занимает 5 минут. Первый месяц — бесплатно.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            className="h-14 px-8 text-lg rounded-2xl bg-white text-blue-600 hover:bg-blue-50"
            onClick={() => setAuthModal('register')}
          >
            Создать новый аккаунт
          </Button>
        </div>
      </section>
      
      {/* Auth Modal */}
      <ClientAuthModal
        isOpen={authModal !== null}
        defaultMode={authModal || 'login'}
        onClose={() => setAuthModal(null)}
        onSuccess={(user) => {
          console.log('Login success - User object:', user);
          // Редирект в зависимости от типа пользователя
          if (user.role === 'owner') {
            console.log('Redirecting to /dashboard');
            navigate('/dashboard');
          } else {
            console.log('Redirecting to /profile');
            navigate('/profile');
          }
        }}
      />
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string, title: string, description: string }) {
  return (
    <Card className="p-6 text-center border-slate-100 shadow-sm hover:shadow-md transition-shadow rounded-3xl">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2 text-slate-900">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </Card>
  );
}
