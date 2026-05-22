import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Users, 
  ArrowRight,
  ChevronRight,
  Ticket,
  MessageSquare
} from 'lucide-react';

export default function CRMDashboard() {
  const { slug } = useParams();

  const { data: business } = useQuery({
    queryKey: ['business', slug],
    queryFn: async () => {
      const res = await axios.get(`/api/businesses/${slug}`);
      return res.data;
    },
  });

  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['stats', slug],
    queryFn: async () => {
      if (!business?.id) return null;
      const res = await axios.get(`/api/dashboard/stats?businessId=${business.id}`);
      return res.data;
    },
    enabled: !!business?.id,
  });

  const { data: bookings, isLoading: isBookingsLoading } = useQuery({
    queryKey: ['bookings', slug],
    queryFn: async () => {
      const res = await axios.get(`/api/businesses/${slug}/bookings`);
      return res.data;
    },
  });

  const pendingBookings = bookings?.filter((b: any) => b.status === 'PENDING').slice(0, 3) || [];
  const todayBookings = bookings?.filter((b: any) => {
    const today = new Date().toISOString().split('T')[0];
    return b.startTime.startsWith(today);
  }) || [];

  // Mock chart data based on bookings
  const chartData = [
    { name: 'Пн', value: 4 },
    { name: 'Вт', value: 7 },
    { name: 'Ср', value: 5 },
    { name: 'Чт', value: 8 },
    { name: 'Пт', value: 12 },
    { name: 'Сб', value: 15 },
    { name: 'Вс', value: 6 },
  ];

  if (isStatsLoading || isBookingsLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2.5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Обзор</h1>
          <p className="text-sm text-gray-500">Добро пожаловать в панель управления {business?.name}</p>
        </div>
        <div className="text-xs sm:text-sm font-medium text-gray-400 shrink-0">
          {format(new Date(), 'EEEE, d MMMM', { locale: ru })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-medium text-gray-500 uppercase">Записей сегодня</CardTitle>
            <Calendar className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.today || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="flex flex-row items-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-medium text-gray-500 uppercase">Ожидают</CardTitle>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pending || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-medium text-gray-500 uppercase">Подтверждены</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.confirmed || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-medium text-gray-500 uppercase">Промокоды</CardTitle>
            <Ticket className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.promocodes || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-medium text-gray-500 uppercase">Новые отзывы</CardTitle>
            <MessageSquare className="w-4 h-4 text-pink-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.reviews || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-white border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[10px] font-medium text-gray-500 uppercase">Доход (мес)</CardTitle>
            <TrendingUp className="w-4 h-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold whitespace-nowrap">{stats?.revenue || 0} ₽</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Section */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Активность за неделю</CardTitle>
            <CardDescription>Количество записей по дням</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#9ca3af', fontSize: 12 }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 5 ? '#3b82f6' : '#e5e7eb'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Attention Section */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Требуют внимания
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingBookings.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Нет новых заявок</p>
              ) : (
                pendingBookings.map((booking: any) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50/50 border border-amber-100">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-gray-900">{booking.clientName}</div>
                      <div className="text-xs text-gray-500">{booking.service?.name || 'Удаленная услуга'}</div>
                    </div>
                    <Link to={`/dashboard/${slug}/calendar`}>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600">
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                ))
              )}
              <Link to={`/dashboard/${slug}/bookings`}>
                <Button variant="ghost" className="w-full text-xs text-gray-500 hover:text-gray-900">
                  Смотреть все
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Ближайшие записи
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {todayBookings.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">На сегодня записей нет</p>
              ) : (
                todayBookings.slice(0, 3).map((booking: any) => (
                  <div key={booking.id} className="flex items-center gap-3">
                    <div className="text-sm font-bold text-blue-600 w-12">
                      {format(new Date(booking.startTime), 'HH:mm')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{booking.clientName}</div>
                      <div className="text-xs text-gray-500 truncate">{booking.service?.name || 'Удаленная услуга'}</div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
