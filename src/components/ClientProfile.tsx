import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, Clock, Ticket, Send, LogOut, User, Scissors, ExternalLink, MessageSquare, Map as MapIcon, Search, Gift, ChevronDown, ChevronUp, Users, Share2, Award, Zap, ThumbsUp, XCircle, MapPin, Phone, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { isToday, isFuture, isPast, startOfDay, endOfDay } from 'date-fns';

export default function ClientProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(localStorage.getItem('clientToken'));
  const [telegramLink, setTelegramLink] = useState<string | null>(null);
  const [showLoyaltyHistory, setShowLoyaltyHistory] = useState(false);
  const [sharePercent, setSharePercent] = useState<number>(50);

  const { data: profileSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['client-profile-summary'],
    queryFn: async () => {
      const [profileRes, followingRes, loyaltyRes, bookingsRes, subscriptionsRes] = await Promise.all([
        axios.get('/api/clients/me', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/following', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/client/loyalty', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/clients/me/bookings', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/clients/me/subscriptions', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      setSharePercent(profileRes.data.client?.referralSharePercent || 50);
      
      return {
        profile: profileRes.data,
        following: followingRes.data,
        loyalty: loyaltyRes.data,
        bookings: bookingsRes.data,
        subscriptions: subscriptionsRes.data
      };
    },
    enabled: !!token,
    staleTime: 10000, // Reduced staleTime for more frequent fresh data
    refetchInterval: 15000 // Refetch every 15 seconds to catch new chat bookings
  });

  const profile = profileSummary?.profile;
  const following = profileSummary?.following;
  const loyalty = profileSummary?.loyalty;
  const bookings = profileSummary?.bookings;
  const subscriptions = profileSummary?.subscriptions;
  const profileLoading = summaryLoading;

  const updateSharePercentMutation = useMutation({
    mutationFn: async (percent: number) => {
      await axios.patch('/api/clients/me', { referralSharePercent: percent }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }
  });

  const linkTelegramMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post('/api/clients/telegram/link-request', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    },
    onSuccess: (data) => {
      setTelegramLink(data.botUrl);
      window.open(data.botUrl, '_blank');
    }
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async (hash: string) => {
      await axios.post(`/api/bookings/${hash}/cancel`, { reason: 'Отмена клиентом из профиля' });
    },
    onSuccess: () => {
      toast.success('Запись успешно отменена');
      queryClient.invalidateQueries({ queryKey: ['client-profile-summary'] });
    },
    onError: () => {
      toast.error('Ошибка при отмене записи');
    }
  });

  const handleLogout = () => {
    localStorage.removeItem('clientToken');
    localStorage.removeItem('userRole');
    setToken(null);
    window.location.href = '/';
  };

  const handleShare = async (business: any) => {
    const clientToken = localStorage.getItem('clientToken');
    let shareUrl = `${window.location.origin}/book/${business.slug}`;
    
    try {
      const res = await axios.post('/api/referral/create', { businessId: business.id }, {
        headers: { Authorization: `Bearer ${clientToken}` }
      });
      shareUrl = `${window.location.origin}/ref/${res.data.code}`;
    } catch (e) {
      console.error('Error creating referral link:', e);
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Рекомендую ${business.name}`,
          text: `Забронируй услугу в ${business.name} по моей ссылке!`,
          url: shareUrl,
        });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Ссылка скопирована в буфер обмена');
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Личный кабинет</CardTitle>
            <CardDescription>Войдите, чтобы управлять своими записями и абонементами</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="text-center py-6">
              <p className="text-slate-600 mb-4">Пожалуйста, войдите на главной странице, чтобы получить доступ к профилю.</p>
              <div className="flex flex-col gap-3">
                <Button 
                    className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700"
                    onClick={() => window.location.href = '/'}
                >
                    На главную
                </Button>
                <Button 
                    variant="outline"
                    className="w-full h-12 rounded-2xl"
                    onClick={() => window.location.href = '/map'}
                >
                    🗺️ Открыть карту заведений
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (profileLoading) return <div className="flex justify-center p-20">Загрузка профиля...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-xl">
                <span className="font-black text-blue-600">B</span>
             </Button>
             <h1 className="font-bold text-lg">Мой кабинет</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/map')} className="rounded-xl border-slate-200 text-slate-600 hidden sm:flex">
                <MapIcon className="w-4 h-4 mr-2" /> Карта
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="rounded-xl text-slate-500">
                <LogOut className="w-4 h-4 mr-2" /> Выйти
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Marketplace Banner */}
        <Card className="overflow-hidden border-none bg-blue-50 shadow-sm group cursor-pointer" onClick={() => navigate('/map')}>
           <CardContent className="p-0">
             <div className="flex items-center">
                <div className="p-5 flex-1 space-y-1">
                    <div className="flex items-center gap-2 text-blue-600">
                        <MapIcon className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Маркетплейс</span>
                    </div>
                    <h3 className="font-black text-lg text-slate-900 leading-tight">Найдите новые услуги на карте</h3>
                    <p className="text-xs text-slate-500">Барбершопы, спа, массаж и многое другое рядом с вами</p>
                </div>
                <div className="w-1/3 bg-blue-100 flex items-center justify-center p-4 group-hover:bg-blue-200 transition-colors">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-lg flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                        🗺️
                    </div>
                </div>
             </div>
           </CardContent>
        </Card>

        {/* User Info Card */}
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-none shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold shrink-0">
                  {profile?.name?.[0]}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{profile?.name}</h2>
                  <p className="text-blue-100 text-sm">{profile?.phone}</p>
                  {profile?.email && <p className="text-blue-100 text-xs">{profile?.email}</p>}
                </div>
              </div>
              <div className="text-left sm:text-right w-full sm:w-auto">
                <div className="bg-white/20 backdrop-blur-md rounded-2xl p-3 inline-block border border-white/10 w-full sm:w-auto">
                   <div className="flex items-center gap-2 mb-0.5">
                      <Gift className="w-4 h-4 text-white" />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Баллы</span>
                   </div>
                   <p className="text-2xl font-black leading-none">{profile?.loyaltyPoints || 0}</p>
                   <p className="text-[10px] opacity-70 mt-1">~ {profile?.loyaltyPoints || 0} ₽</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loyalty History (Collapsible or just as a card) */}
        {loyalty?.transactions && loyalty.transactions.length > 0 && (
          <Card className="border-slate-100 shadow-sm overflow-hidden">
            <CardHeader className="py-3 px-4 bg-slate-50/50 border-b border-slate-100 cursor-pointer flex flex-row items-center justify-between" onClick={() => setShowLoyaltyHistory(!showLoyaltyHistory)}>
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">История баллов</span>
              </div>
              {showLoyaltyHistory ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </CardHeader>
            {showLoyaltyHistory && (
              <CardContent className="p-0">
                <div className="max-h-60 overflow-y-auto">
                  {loyalty.transactions.map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 border-b last:border-0 border-slate-50 hover:bg-slate-50/30 transition-colors">
                      <div className="flex gap-3 items-center">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs",
                          tx.points > 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                        )}>
                          {tx.points > 0 ? '+' : '-'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{tx.description || (tx.type === 'EARN' ? 'За завершение заказа' : 'Использовано баллов')}</p>
                          <p className="text-[10px] text-slate-500">{format(new Date(tx.createdAt), 'd MMMM HH:mm', { locale: ru })}</p>
                        </div>
                      </div>
                      <span className={cn("font-black text-sm", tx.points > 0 ? "text-emerald-600" : "text-red-700")}>
                        {tx.points > 0 ? `+${tx.points}` : tx.points}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Telegram Connection */}
        <Card className={cn(
          "overflow-hidden transition-all duration-300",
          profile?.telegramChatId 
            ? "border-emerald-100 bg-emerald-50/30" 
            : "border-blue-100 bg-blue-50/50"
        )}>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors",
                  profile?.telegramChatId ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"
                )}>
                  <Send className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">Telegram Уведомления</h3>
                  {profile?.telegramChatId ? (
                    <div className="space-y-1">
                      <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 h-5 px-1.5 rounded-md">Активно</Badge>
                        {profile.telegramUsername && `@${profile.telegramUsername}`}
                      </p>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        Вы получаете напоминания и новости прямо в Telegram. Все SMS отключены.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
                      Получайте напоминания о записях и новости прямо в мессенджер @Slotsmsbot
                    </p>
                  )}
                </div>
              </div>
              <div className="w-full md:w-auto">
                {profile?.telegramChatId ? (
                   <Button 
                    variant="outline"
                    size="sm"
                    className="w-full md:w-auto rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                    onClick={() => linkTelegramMutation.mutate()}
                    disabled={linkTelegramMutation.isPending}
                   >
                     {linkTelegramMutation.isPending ? 'Загрузка...' : 'Перепривязать аккаунт'}
                   </Button>
                ) : (
                  <Button 
                    size="sm" 
                    className="bg-blue-600 hover:bg-blue-700 w-full md:w-auto rounded-xl shadow-lg shadow-blue-100"
                    onClick={() => linkTelegramMutation.mutate()}
                    disabled={linkTelegramMutation.isPending}
                  >
                    {linkTelegramMutation.isPending ? 'Загрузка...' : 'Подключить @Slotsmsbot'}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="bookings" className="space-y-4">
          <TabsList className="flex w-full overflow-x-auto no-scrollbar gap-1 bg-slate-100 p-1 h-12 rounded-2xl md:grid md:grid-cols-5 shrink-0">
            <TabsTrigger className="rounded-xl flex-1 md:flex-initial whitespace-nowrap text-xs md:text-sm px-3" value="bookings">Записи</TabsTrigger>
            <TabsTrigger className="rounded-xl flex-1 md:flex-initial whitespace-nowrap text-xs md:text-sm px-3" value="following">Подписки</TabsTrigger>
            <TabsTrigger className="rounded-xl flex-1 md:flex-initial whitespace-nowrap text-xs md:text-sm px-3" value="referrals">Рефералы</TabsTrigger>
            <TabsTrigger className="rounded-xl flex-1 md:flex-initial whitespace-nowrap text-xs md:text-sm px-3" value="subscriptions">Абонементы</TabsTrigger>
            <TabsTrigger className="rounded-xl flex-1 md:flex-initial whitespace-nowrap text-xs md:text-sm px-3" value="discover">Карта</TabsTrigger>
          </TabsList>

           <TabsContent value="bookings" className="space-y-6">
              <Tabs defaultValue="all-bookings" className="w-full">
                <TabsList className="bg-transparent h-auto p-0 gap-6 border-b rounded-none w-full justify-start overflow-x-auto no-scrollbar">
                  <TabsTrigger value="all-bookings" className="data-[state=active]:border-blue-600 data-[state=active]:bg-transparent border-b-2 border-transparent rounded-none px-0 pb-2 h-auto font-bold text-slate-500 data-[state=active]:text-blue-600">Все</TabsTrigger>
                  <TabsTrigger value="today-bookings" className="data-[state=active]:border-blue-600 data-[state=active]:bg-transparent border-b-2 border-transparent rounded-none px-0 pb-2 h-auto font-bold text-slate-500 data-[state=active]:text-blue-600">Сегодня</TabsTrigger>
                  <TabsTrigger value="upcoming-bookings" className="data-[state=active]:border-blue-600 data-[state=active]:bg-transparent border-b-2 border-transparent rounded-none px-0 pb-2 h-auto font-bold text-slate-500 data-[state=active]:text-blue-600">Будущие</TabsTrigger>
                  <TabsTrigger value="past-bookings" className="data-[state=active]:border-blue-600 data-[state=active]:bg-transparent border-b-2 border-transparent rounded-none px-0 pb-2 h-auto font-bold text-slate-500 data-[state=active]:text-blue-600">История</TabsTrigger>
                </TabsList>

                <div className="mt-6">
                  <TabsContent value="all-bookings" className="mt-0 space-y-6">
                    {bookings && bookings.length > 0 ? (
                      <>
                        <BookingSection 
                          title="Сегодня" 
                          bookings={bookings
                            .filter((b: any) => isToday(new Date(b.startTime)) && b.status !== 'CANCELLED')
                            .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                          } 
                          onCancel={(hash) => cancelBookingMutation.mutate(hash)} 
                          isPending={cancelBookingMutation.isPending} 
                        />
                        <BookingSection 
                          title="Будущие записи" 
                          bookings={bookings
                            .filter((b: any) => isFuture(new Date(b.startTime)) && !isToday(new Date(b.startTime)) && b.status !== 'CANCELLED')
                            .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                          } 
                          onCancel={(hash) => cancelBookingMutation.mutate(hash)} 
                          isPending={cancelBookingMutation.isPending} 
                        />
                        <BookingSection 
                          title="История" 
                          bookings={bookings
                            .filter((b: any) => isPast(new Date(b.startTime)) || b.status === 'CANCELLED')
                            .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                          } 
                        />
                      </>
                    ) : (
                      <EmptyState />
                    )}
                  </TabsContent>

                  <TabsContent value="today-bookings" className="mt-0">
                    <BookingSection 
                      title="Записи на сегодня" 
                      bookings={bookings?.filter((b: any) => isToday(new Date(b.startTime)) && b.status !== 'CANCELLED')
                        .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                      } 
                      onCancel={(hash) => cancelBookingMutation.mutate(hash)} 
                      isPending={cancelBookingMutation.isPending} 
                      emptyMessage="На сегодня записей нет" 
                    />
                  </TabsContent>

                  <TabsContent value="upcoming-bookings" className="mt-0">
                    <BookingSection 
                      title="Предстоящие записи" 
                      bookings={bookings?.filter((b: any) => isFuture(new Date(b.startTime)) && !isToday(new Date(b.startTime)) && b.status !== 'CANCELLED')
                        .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                      } 
                      onCancel={(hash) => cancelBookingMutation.mutate(hash)} 
                      isPending={cancelBookingMutation.isPending} 
                      emptyMessage="У вас нет будущих записей" 
                    />
                  </TabsContent>

                  <TabsContent value="past-bookings" className="mt-0">
                    <BookingSection 
                      title="Завершенные и отмененные" 
                      bookings={bookings?.filter((b: any) => isPast(new Date(b.startTime)) || b.status === 'CANCELLED')
                        .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                      } 
                      emptyMessage="История записей пуста" 
                    />
                  </TabsContent>
                </div>
              </Tabs>
          </TabsContent>

          <TabsContent value="following" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {following?.map((business: any) => (
                <Card key={business.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/book/${business.slug}`)}>
                  <CardContent className="p-0">
                     <div className="h-20 bg-slate-100 relative">
                        {business.coverImage && <img src={business.coverImage} className="w-full h-full object-cover" />}
                     </div>
                     <div className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center -mt-8 border-4 border-white shadow-sm overflow-hidden bg-white">
                           {business.logo ? <img src={business.logo} className="w-full h-full object-cover" /> : <span className="font-bold text-blue-600">{business.name[0]}</span>}
                        </div>
                        <div className="flex-1">
                           <h4 className="font-bold text-sm tracking-tight">{business.name}</h4>
                           <p className="text-[10px] text-slate-500 uppercase font-black">{business.city}</p>
                        </div>
                        <div className="flex items-center gap-1">
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="rounded-full h-8 w-8 text-blue-600 hover:bg-blue-50"
                             onClick={(e) => {
                               e.stopPropagation();
                               handleShare(business);
                             }}
                           >
                              <Share2 className="w-4 h-4" />
                           </Button>
                           <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                              <ChevronDown className="w-4 h-4 -rotate-90" />
                           </Button>
                        </div>
                     </div>
                  </CardContent>
                </Card>
              ))}
              {following?.length === 0 && (
                <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed text-slate-400">
                  <span className="text-4xl block mb-2">👤</span>
                  Вы еще ни на кого не подписаны
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="referrals" className="space-y-4">
            <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none shadow-xl overflow-hidden relative">
               <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Users size={120} />
               </div>
               <CardContent className="p-6 relative z-10 space-y-6">
                  <div className="space-y-2">
                     <div className="flex items-center gap-2">
                        <Badge className="bg-white/20 hover:bg-white/30 text-white border-none">NEW</Badge>
                        <h3 className="font-black text-xl tracking-tight">Реферальная программа</h3>
                     </div>
                     <p className="text-indigo-100 text-sm leading-relaxed max-w-sm">
                        Распределяйте награду между собой и другом. Ваши друзья получат скидку, а вы — баллы!
                     </p>
                  </div>

                  <div className="bg-white/10 backdrop-blur-md rounded-[24px] p-5 border border-white/10 space-y-4">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                              <Gift className="w-5 h-5" />
                           </div>
                           <div>
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Всего заработано</p>
                              <p className="text-2xl font-black">{profile?.client?.referralPoints || 0} баллов</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <Award className="w-8 h-8 opacity-20 ml-auto" />
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div className="flex items-center justify-between text-sm font-bold">
                        <span className="flex items-center gap-2"><ThumbsUp size={16} /> Другу: {100 - sharePercent}%</span>
                        <span className="flex items-center gap-2"><Zap size={16} /> Мне: {sharePercent}%</span>
                     </div>
                     <Slider 
                        value={[sharePercent]} 
                        max={100} 
                        step={1} 
                        onValueChange={vals => setSharePercent(vals[0])}
                        onValueCommitted={vals => updateSharePercentMutation.mutate(vals[0])}
                        className="py-4"
                     />
                     <div className="flex justify-between text-[10px] uppercase font-black tracking-widest opacity-60">
                        <span>Больше другу</span>
                        <span>50/50</span>
                        <span>Больше мне</span>
                     </div>
                  </div>

                  <Button className="w-full h-14 rounded-2xl bg-white text-indigo-700 hover:bg-indigo-50 font-black text-lg gap-2 shadow-xl shadow-indigo-900/20" onClick={() => navigate('/map')}>
                     <Share2 size={20} />
                     ПРИГЛАСИТЬ ДРУЗЕЙ
                  </Button>
               </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="subscriptions">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subscriptions?.map((sub: any) => (
                <Card key={sub.id} className="overflow-hidden">
                  <div className="h-2 bg-blue-600" />
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{sub.subscription?.name || 'Удаленный абонемент'}</CardTitle>
                    <CardDescription>{sub.subscription?.service?.name || 'Удаленная услуга'}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-xs text-slate-400 uppercase">Осталось визитов</p>
                        <p className="text-3xl font-bold text-blue-600">{sub.remainingVisits}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400 uppercase">Всего</p>
                        <p className="text-lg font-semibold">{sub.subscription.totalVisits}</p>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full transition-all" 
                        style={{ width: `${(sub.remainingVisits / sub.subscription.totalVisits) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      Действует до {format(new Date(sub.expiresAt), 'd MMMM yyyy', { locale: ru })}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {subscriptions?.length === 0 && (
                <div className="col-span-full text-center py-20 bg-white rounded-xl border border-dashed">
                  <Ticket className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 text-sm">У вас пока нет активных абонементов</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="discover" className="space-y-4">
             <Card className="text-center py-10 rounded-2xl border-dashed">
               <CardContent className="space-y-4">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto text-2xl">
                    🗺️
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-lg">Найдите идеальное место</h3>
                    <p className="text-sm text-slate-500">Откройте карту всех заведений и выберите лучшее по рейтингу и расположению</p>
                  </div>
                  <Button className="w-full rounded-xl bg-blue-600" onClick={() => navigate('/map')}>
                    <MapIcon className="w-4 h-4 mr-2" /> Открыть карту
                  </Button>
               </CardContent>
             </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function BookingSection({ title, bookings, onCancel, isPending, emptyMessage }: { title: string, bookings: any[], onCancel?: (hash: string) => void, isPending?: boolean, emptyMessage?: string }) {
  if (!bookings || bookings.length === 0) {
    if (!emptyMessage) return null;
    return (
      <div className="py-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
        <p className="text-slate-400 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{title}</h3>
      <div className="space-y-3">
        {bookings.map((booking: any) => (
          <BookingCard key={booking.id} booking={booking} onCancel={onCancel} isPending={isPending} />
        ))}
      </div>
    </div>
  );
}

function BookingCard({ booking, onCancel, isPending }: { booking: any, onCancel?: (hash: string) => void, isPending?: boolean }) {
  const isPastBooking = isPast(new Date(booking.startTime)) || booking.status === 'CANCELLED';
  const navigate = useNavigate();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Подтверждено</Badge>;
      case 'PENDING':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">Ожидает</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Отменено</Badge>;
      case 'COMPLETED':
        return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Выполнено</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200 hover:shadow-md",
      isPastBooking ? "opacity-75 grayscale-[0.5]" : "border-l-4 border-l-blue-600 shadow-sm"
    )}>
      <CardContent className="p-0">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 space-y-3">
             <div className="flex items-center justify-between sm:justify-start gap-3">
               <div className="bg-blue-50 text-blue-700 p-2 rounded-xl">
                 <Calendar className="w-5 h-5" />
               </div>
               <div>
                  <p className="font-black text-slate-900 leading-tight">
                    {format(new Date(booking.startTime), 'd MMMM, EEEE', { locale: ru })}
                  </p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(booking.startTime), 'HH:mm')} • {booking.service?.durationMinutes} мин
                  </p>
               </div>
               <div className="sm:hidden">
                 {getStatusBadge(booking.status)}
               </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 pt-1">
                <div className="space-y-1">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Услуга и мастер</p>
                   <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                      <Scissors className="w-4 h-4 text-blue-600/50" />
                      {booking.service?.name}
                   </div>
                   <p className="text-xs text-slate-500 ml-6">Мастер: {booking.staff?.name}</p>
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Место</p>
                   <div className="flex items-center gap-2 text-sm font-bold text-slate-800 cursor-pointer hover:text-blue-600 transition-colors" onClick={() => navigate(`/book/${booking.business.slug}`)}>
                      <MapIcon className="w-4 h-4 text-blue-600/50" />
                      {booking.business?.name}
                   </div>
                   {booking.business?.address && (
                     <div className="flex items-start gap-1 text-[11px] text-slate-500 ml-6 leading-tight">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                        {booking.business.address}
                     </div>
                   )}
                </div>
             </div>
          </div>

          <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-50">
             <div className="hidden sm:block mb-2">
                {getStatusBadge(booking.status)}
             </div>
             
             {!isPastBooking && booking.status !== 'CANCELLED' && (
               <div className="flex items-center gap-2 w-full sm:w-auto">
                 <Button 
                   variant="outline" 
                   size="sm" 
                   className="flex-1 sm:flex-initial rounded-xl text-xs h-9 border-slate-200 hover:bg-slate-50"
                   onClick={() => navigate(`/rebook/${booking.confirmHash}`)}
                 >
                   Перенести
                 </Button>
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   className="flex-1 sm:flex-initial rounded-xl text-xs h-9 text-red-600 hover:bg-red-50 hover:text-red-700"
                   onClick={() => onCancel && onCancel(booking.confirmHash)}
                   disabled={isPending}
                 >
                   {isPending ? '...' : <><XCircle className="w-4 h-4 mr-1.5" /> Отменить</>}
                 </Button>
               </div>
             )}

             {isPastBooking && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full sm:w-auto rounded-xl text-xs h-9 border-blue-100 text-blue-600 hover:bg-blue-50"
                  onClick={() => navigate(`/book/${booking.business.slug}`)}
                >
                  Записаться снова
                </Button>
             )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200 space-y-4">
      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300">
        <History className="w-10 h-10" />
      </div>
      <div className="space-y-2">
        <h3 className="font-bold text-slate-900">У вас пока нет записей</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          Бронируйте услуги в лучших заведениях города через BookBot
        </p>
      </div>
      <Button className="rounded-2xl bg-blue-600" onClick={() => window.location.href = '/map'}>
        Найти заведение
      </Button>
    </div>
  );
}
