import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select as UISelect, SelectContent as UISelectContent, SelectItem as UISelectItem, SelectTrigger as UISelectTrigger, SelectValue as UISelectValue } from '@/components/ui/select';
import { AddressAutocomplete } from './AddressAutocomplete';
import { toast } from 'sonner';
import { Save, Building2, Clock, Bell, Trash2, AlertTriangle, CreditCard, Instagram, Link as LinkIcon, Copy, Code, Sparkles, Send, Map as MapIcon, Gift } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MarketingSettings from './MarketingSettings';
import LoyaltySettings from './LoyaltySettings';
import { cn } from '@/lib/utils';

const businessSchema = z.object({
  name: z.string().min(3, 'Минимум 3 символа'),
  address: z.string().min(5, 'Минимум 5 символов'),
  phone: z.string().min(10, 'Минимум 10 цифр'),
  description: z.string().optional(),
  workingHours: z.any(),
  bookingRulesEnabled: z.boolean().default(false),
  slotDuration: z.coerce.number().min(5).max(120),
  bookingLeadTimeHours: z.coerce.number().min(0),
  maxBookingDaysAhead: z.coerce.number().min(1),
  smsEnabled: z.boolean().default(false),
  smsTemplate: z.string().optional(),
  autoConfirmBookings: z.boolean().default(true),
  requireApprovalFor: z.array(z.string()).default([]),
  paymentEnabled: z.boolean().default(false),
  paymentProvider: z.string().optional(),
  yukassaShopId: z.string().optional(),
  yukassaSecretKey: z.string().optional(),
  requirePrepayment: z.boolean().default(false),
  prepaymentPercent: z.coerce.number().min(0).max(100).default(0),
  isPublished: z.boolean().default(false),
  categoryId: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  isReferralEnabled: z.boolean().default(false),
  referralRewardPercent: z.coerce.number().min(1).max(100).default(10),
});

type BusinessFormValues = z.infer<typeof businessSchema>;

const DAYS = [
  { id: 'mon', label: 'Понедельник' },
  { id: 'tue', label: 'Вторник' },
  { id: 'wed', label: 'Среда' },
  { id: 'thu', label: 'Четверг' },
  { id: 'fri', label: 'Пятница' },
  { id: 'sat', label: 'Суббота' },
  { id: 'sun', label: 'Воскресенье' },
];

export default function BusinessSettings() {
  const { slug } = useParams();
  const queryClient = useQueryClient();

  const { data: business, isLoading } = useQuery({
    queryKey: ['business', slug],
    queryFn: async () => {
      const res = await axios.get(`/api/businesses/${slug}`);
      return res.data;
    },
  });

  const { data: services } = useQuery({
    queryKey: ['services', slug],
    queryFn: async () => {
      const res = await axios.get(`/api/services?businessId=${business?.id}`);
      return res.data;
    },
    enabled: !!business?.id,
  });

  const { data: marketplaceCategories } = useQuery({
    queryKey: ['marketplace-categories-all'],
    queryFn: async () => {
      const res = await axios.get('/api/marketplace/categories');
      return res.data;
    },
  });

  const form = useForm<any>({
    resolver: zodResolver(businessSchema),
    values: business ? {
      name: business.name || '',
      address: business.address || '',
      description: business.description || '',
      phone: business.phone || '',
      workingHours: business.workingHours || DAYS.reduce((acc, day) => ({
        ...acc,
        [day.id]: { isOpen: true, start: '10:00', end: '20:00' }
      }), {}),
      bookingRulesEnabled: business.bookingRulesEnabled ?? false,
      slotDuration: business.slotDuration ?? 30,
      bookingLeadTimeHours: business.bookingLeadTimeHours ?? 2,
      maxBookingDaysAhead: business.maxBookingDaysAhead ?? 30,
      smsEnabled: business.smsEnabled ?? false,
      smsTemplate: business.smsTemplate || 'Запись подтверждена! {client_name}, ждем вас {date} в {time}. {business_name}, {address}',
      autoConfirmBookings: business.autoConfirmBookings ?? true,
      requireApprovalFor: JSON.parse(business.requireApprovalFor || "[]"),
      paymentEnabled: business.paymentEnabled ?? false,
      paymentProvider: business.paymentProvider || 'yookassa',
      yukassaShopId: business.yukassaShopId || '',
      yukassaSecretKey: business.yukassaSecretKey || '',
      requirePrepayment: business.requirePrepayment ?? false,
      prepaymentPercent: business.prepaymentPercent ?? 20,
      isPublished: business.isPublished ?? false,
      categoryId: business.categoryId || '',
      latitude: business.latitude || null,
      longitude: business.longitude || null,
      isReferralEnabled: business.isReferralEnabled ?? false,
      referralRewardPercent: business.referralRewardPercent ?? 10,
    } : {
      name: '',
      address: '',
      description: '',
      phone: '',
      workingHours: DAYS.reduce((acc, day) => ({
        ...acc,
        [day.id]: { isOpen: true, start: '10:00', end: '20:00' }
      }), {}),
      bookingRulesEnabled: false,
      slotDuration: 30,
      bookingLeadTimeHours: 2,
      maxBookingDaysAhead: 30,
      smsEnabled: false,
      smsTemplate: '',
      autoConfirmBookings: true,
      requireApprovalFor: [],
      paymentEnabled: false,
      paymentProvider: 'yookassa',
      yukassaShopId: '',
      yukassaSecretKey: '',
      requirePrepayment: false,
      prepaymentPercent: 20,
      isPublished: false,
      categoryId: '',
      latitude: null,
      longitude: null,
      isReferralEnabled: false,
      referralRewardPercent: 10,
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: BusinessFormValues) => {
      const payload = {
        ...values,
        requireApprovalFor: JSON.stringify(values.requireApprovalFor)
      };
      await axios.patch(`/api/business/${slug}`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ownerToken')}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', slug] });
      toast.success('Настройки сохранены');
    },
    onError: (error: any) => {
      const message = error.response?.data?.details || error.message || 'Ошибка при сохранении';
      toast.error(`Ошибка: ${message}`);
    },
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await axios.delete(`/api/business/${slug}`);
    },
    onSuccess: () => {
      toast.success('Бизнес удален');
      window.location.href = '/dashboard';
    },
    onError: (error: any) => {
      toast.error('Ошибка при удалении бизнеса');
    },
  });

  const copyToAllDays = (dayId: string) => {
    const hours = form.getValues(`workingHours.${dayId}`);
    DAYS.forEach(day => {
      form.setValue(`workingHours.${day.id}`, { ...hours });
    });
    toast.info('Расписание скопировано на все дни');
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="general" className="w-full min-h-screen flex flex-col bg-slate-50/30">
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Настройки бизнеса</h2>
              <p className="text-sm text-slate-500">Управляйте информацией о вашем заведении и правилами записи</p>
            </div>
            <Button 
              onClick={form.handleSubmit((v) => updateMutation.mutate(v))} 
              disabled={updateMutation.isPending}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 h-11 px-6"
            >
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending ? 'Сохранение...' : 'Сохранить изменения'}
            </Button>
          </div>

          <TabsList className="bg-slate-100/50 p-1 rounded-xl w-full flex justify-start overflow-x-auto border border-slate-200/50">
            <TabsTrigger value="general" className="rounded-lg px-6 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all">
              Основные
            </TabsTrigger>
            <TabsTrigger value="schedule" className="rounded-lg px-6 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all">
              Расписание
            </TabsTrigger>
            <TabsTrigger value="marketplace" className="rounded-lg px-6 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all flex items-center gap-2">
              <MapIcon className="w-3 h-3" /> Маркетплейс
            </TabsTrigger>
            <TabsTrigger value="marketing" className="rounded-lg px-6 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all flex items-center gap-2">
              <Sparkles className="w-3 h-3" /> Маркетинг
            </TabsTrigger>
            <TabsTrigger value="loyalty" className="rounded-lg px-6 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all flex items-center gap-2">
              <Gift className="w-3 h-3" /> Лояльность
            </TabsTrigger>
            <TabsTrigger value="integrations" className="rounded-lg px-6 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all">
              Интеграции
            </TabsTrigger>
            <TabsTrigger value="widget" className="rounded-lg px-6 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all">
              Виджет
            </TabsTrigger>
            <TabsTrigger value="danger" className="rounded-lg px-6 py-2 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm transition-all">
              Удаление
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="max-w-5xl mx-auto pb-24">
          <TabsContent value="marketplace">
      <Form {...form}>
        <form className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                    <MapIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h3 className="text-lg font-bold">Маркетплейс BookBot</h3>
                    <p className="text-xs text-slate-500">Клиенты смогут найти вас на карте bookbot.app/map</p>
                </div>
            </div>
            
            <div className="space-y-6">
                {/* Переключатель публикации */}
                <FormField
                    control={form.control}
                    name="isPublished"
                    render={({ field }) => (
                    <FormItem className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="space-y-0.5">
                            <FormLabel className="text-base font-bold">Опубликовать на карте</FormLabel>
                            <FormDescription className="text-xs">
                                Новые клиенты смогут найти вас в поиске
                            </FormDescription>
                        </div>
                        <FormControl>
                            <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        </FormControl>
                    </FormItem>
                    )}
                />

                <div className={cn("space-y-6 transition-all", !form.watch('isPublished') && "opacity-50 grayscale pointer-events-none scale-[0.98]")}>
                    {/* Выбор категории */}
                    <FormField
                        control={form.control}
                        name="categoryId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-bold">Категория бизнеса</FormLabel>
                            <UISelect onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                    <UISelectTrigger className="rounded-xl h-11 border-slate-200">
                                        <UISelectValue placeholder="Выберите основную категорию" />
                                    </UISelectTrigger>
                                </FormControl>
                                <UISelectContent className="rounded-xl">
                                    {(marketplaceCategories || []).map((cat: any) => (
                                        <UISelectItem key={cat.id} value={cat.id}>
                                            <span className="mr-2">{cat.icon}</span>
                                            {cat.name}
                                        </UISelectItem>
                                    ))}
                                </UISelectContent>
                            </UISelect>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    {/* Адрес с геолокацией */}
                    <FormField
                        control={form.control}
                        name="address"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel className="font-bold">Адрес для поиска</FormLabel>
                            <FormControl>
                                <AddressAutocomplete 
                                    value={field.value} 
                                    onChange={(data) => {
                                        console.log('Address selected:', data);
                                        form.setValue('address', data.address);
                                        form.setValue('latitude', data.latitude);
                                        form.setValue('longitude', data.longitude);
                                    }} 
                                />
                            </FormControl>
                            <FormDescription className="text-[10px]">
                                Начните вводить адрес, и мы автоматически определим координаты для карты
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                        )}
                    />

                    {/* Карта-превью */}
                    {form.watch('latitude') && form.watch('longitude') && (
                        <div className="space-y-2">
                             <Label className="text-xs font-bold uppercase tracking-wider text-slate-400">Превью на карте</Label>
                             <div className="h-40 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50 relative group">
                                <div
                                    id="settings-map"
                                    className="w-full h-full"
                                    ref={(el) => {
                                        if (el && window.ymaps3 && form.watch('latitude') && form.watch('longitude')) {
                                            window.ymaps3.ready.then(() => {
                                                const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = window.ymaps3;
                                                if (!el) return;
                                                el.innerHTML = '';
                                                
                                                const lat = form.getValues('latitude');
                                                const lng = form.getValues('longitude');
                                                if (!lat || !lng) return;

                                                const map = new YMap(el, {
                                                    location: {
                                                        center: [lng, lat],
                                                        zoom: 15
                                                    }
                                                });
                                                map.addChild(new YMapDefaultSchemeLayer());
                                                map.addChild(new YMapDefaultFeaturesLayer());
                                                
                                                const markerEl = document.createElement('div');
                                                markerEl.innerHTML = '<div style="font-size: 32px; transform: translate(-50%, -100%); line-height: 1;">📍</div>';
                                                
                                                map.addChild(new YMapMarker({ 
                                                    coordinates: [lng, lat]
                                                }, markerEl));
                                            });
                                        }
                                    }}
                                />
                                <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                     <p className="text-[10px] text-white font-medium text-center">Координаты: {form.watch('latitude')?.toFixed(4)}, {form.watch('longitude')?.toFixed(4)}</p>
                                </div>
                             </div>
                        </div>
                    )}
                </div>
            </div>
          </Card>

          <div className="space-y-6">
              <Card className="p-6">
                <h3 className="font-bold mb-4">Как это выглядит?</h3>
                <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
                             {form.watch('categoryId') ? (marketplaceCategories?.find((c:any) => c.id === form.watch('categoryId'))?.icon) : '🏪'}
                        </div>
                        <div>
                            <p className="font-bold text-sm tracking-tight">{form.watch('name') || 'Название'}</p>
                            <p className="text-[10px] text-slate-500">{form.watch('address') || 'Адрес не указан'}</p>
                        </div>
                    </div>
                    <div className="flex gap-1.5">
                        <Badge variant="outline" className="text-[9px] bg-white">4.9 ⭐</Badge>
                        <Badge variant="outline" className="text-[9px] bg-white">Открыто 🟢</Badge>
                    </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
                    * После публикации ваш бизнес станет доступен миллионам пользователей в нашем каталоге. Убедитесь, что вы загрузили качественный логотип и описание.
                </p>
              </Card>
          </div>
        </form>
      </Form>
    </TabsContent>

    <TabsContent value="general">
          <Form {...form}>
            <form className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    Основная информация
                  </CardTitle>
                  <CardDescription>Контактные данные вашего заведения</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Название</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Адрес</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Телефон</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Описание для маркетплейса</FormLabel>
                        <FormControl>
                          <Textarea {...field} className="h-32" placeholder="Расскажите о своем бизнесе..." />
                        </FormControl>
                        <FormDescription>Это описание будет отображаться в каталоге</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      Правила записи
                    </CardTitle>
                    <CardDescription>Настройте временные интервалы и ограничения</CardDescription>
                  </div>
                  <FormField
                    control={form.control}
                    name="bookingRulesEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardHeader>
                <CardContent className={cn("space-y-4 transition-opacity", !form.watch('bookingRulesEnabled') && "opacity-50 pointer-events-none")}>
                  <FormField
                    control={form.control}
                    name="slotDuration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Длительность слота (мин)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>Шаг времени в календаре записи</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bookingLeadTimeHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Мин. время до записи (ч)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maxBookingDaysAhead"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Запись вперед (дней)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="autoConfirmBookings"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={!!field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Автоматически подтверждать записи</FormLabel>
                          <p className="text-xs text-gray-500">
                            Записи будут сразу переходить в статус "Подтверждено"
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  {!form.watch('autoConfirmBookings') && (
                    <FormField
                      control={form.control}
                      name="requireApprovalFor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Требовать одобрение для услуг:</FormLabel>
                          <div className="grid grid-cols-1 gap-2 border rounded-md p-3 max-h-40 overflow-y-auto">
                            {services?.map((service: any) => (
                              <div key={service.id} className="flex items-center gap-2">
                                <Checkbox 
                                  checked={!!field.value.includes(service.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...field.value, service.id]);
                                    } else {
                                      field.onChange(field.value.filter((id: string) => id !== service.id));
                                    }
                                  }}
                                />
                                <span className="text-sm">{service.name}</span>
                              </div>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="danger">
          <div className="max-w-2xl mx-auto">
            <Card className="border-red-200 bg-red-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-5 h-5" />
                  Опасная зона
                </CardTitle>
                <CardDescription className="text-red-600/80">
                  Удаление бизнеса приведет к безвозвратной потере всех данных
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-red-600 mb-6">
                  Все записи, список клиентов, услуги и настройки будут удалены навсегда. 
                  Это действие нельзя отменить.
                </p>
                {showDeleteConfirm ? (
                  <div className="space-y-4 p-4 bg-white rounded-2xl border border-red-100 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <p className="text-sm font-bold text-red-700 text-center">Вы абсолютно уверены?</p>
                    <div className="flex gap-3">
                      <Button 
                        variant="destructive" 
                        className="flex-1 rounded-xl h-11"
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? 'Удаление...' : 'Да, удалить навсегда'}
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 rounded-xl h-11"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={deleteMutation.isPending}
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    variant="destructive" 
                    className="w-full rounded-xl h-12 shadow-md shadow-red-100"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Удалить бизнес «{business?.name}»
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

    <TabsContent value="schedule">
      <Form {...form}>
        <form className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                График работы
              </CardTitle>
              <CardDescription>Укажите время работы вашего заведения по дням недели</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {DAYS.map((day) => (
                <div key={day.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <Checkbox 
                      checked={!!form.watch(`workingHours.${day.id}.isOpen`)}
                      onCheckedChange={(checked) => form.setValue(`workingHours.${day.id}.isOpen`, !!checked)}
                    />
                    <span className="text-sm font-medium w-24">{day.label}</span>
                  </div>
                  
                  <div className={cn("flex items-center gap-2 transition-opacity", !form.watch(`workingHours.${day.id}.isOpen`) && "opacity-30 pointer-events-none")}>
                    <Input 
                      type="time" 
                      className="w-24 h-8 text-xs" 
                      {...form.register(`workingHours.${day.id}.start`)}
                    />
                    <span className="text-slate-400">—</span>
                    <Input 
                      type="time" 
                      className="w-24 h-8 text-xs" 
                      {...form.register(`workingHours.${day.id}.end`)}
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => copyToAllDays(day.id)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-blue-600" />
                  Уведомления
                </CardTitle>
                <CardDescription>Настройка SMS-оповещений</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="smsEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={!!field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Включить SMS-уведомления</FormLabel>
                        <p className="text-xs text-gray-500">
                          Клиенты будут получать подтверждение записи по SMS
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="smsTemplate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Шаблон сообщения</FormLabel>
                      <FormControl>
                        <Textarea className="h-24" {...field} disabled={!form.watch('smsEnabled')} />
                      </FormControl>
                      <FormDescription className="text-[10px]">
                        Доступные теги: {'{client_name}, {date}, {time}, {service}, {master}, {business_name}, {address}'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  Онлайн-оплата (ЮKassa)
                </CardTitle>
                <CardDescription>Настройте прием платежей и предоплату</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="paymentEnabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={!!field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Включить онлайн-оплату</FormLabel>
                        <p className="text-xs text-gray-500">
                          Клиенты смогут оплачивать услуги при записи
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch('paymentEnabled') && (
                  <div className="space-y-4 pt-2">
                    <FormField
                      control={form.control}
                      name="yukassaShopId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ЮKassa Shop ID</FormLabel>
                          <FormControl>
                            <Input placeholder="123456" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="yukassaSecretKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secret Key</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="live_..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="requirePrepayment"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={!!field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Требовать предоплату</FormLabel>
                            <p className="text-xs text-gray-500">
                              Запись будет подтверждена только после оплаты части стоимости
                            </p>
                          </div>
                        </FormItem>
                      )}
                    />
                    {form.watch('requirePrepayment') && (
                      <FormField
                        control={form.control}
                        name="prepaymentPercent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Процент предоплаты (%)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Instagram className="w-5 h-5 text-blue-600" />
                  Интеграция с Instagram
                </CardTitle>
                <CardDescription>Ссылка для Bio вашего профиля</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <FormLabel>Ваша ссылка для записи</FormLabel>
                  <div className="flex gap-2">
                    <Input 
                      readOnly 
                      value={`${window.location.origin}/ig/${slug}`} 
                      className="bg-gray-50"
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/ig/${slug}`);
                        toast.success('Ссылка скопирована');
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Эта ссылка оптимизирована для мобильных устройств и Instagram Bio.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>
    </TabsContent>

    <TabsContent value="marketing">
      <MarketingSettings businessId={business?.id} />
    </TabsContent>

    <TabsContent value="loyalty">
      <div className="max-w-4xl mx-auto">
        <LoyaltySettings />
      </div>
    </TabsContent>

    <TabsContent value="integrations">
      <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-600" />
                Telegram Уведомления
              </CardTitle>
              <CardDescription>Статус системных уведомлений</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-900">Вы используете единый бот уведомлений</p>
                  <p className="text-xs text-blue-700/80 mt-1">Клиенты получают уведомления и напоминания через официального бота <strong>@Slotsmsbot</strong>. Привязка происходит автоматически в личном кабинете клиента.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                Дополнительно
              </CardTitle>
              <CardDescription>Дополнительные настройки интеграций</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">
                Здесь будут появляться новые интеграции (WhatsApp, VK и др.) для вашего бизнеса.
              </p>
            </CardContent>
          </Card>
      </div>
    </TabsContent>

    <TabsContent value="widget">
      <div className="space-y-6">
                <Tabs defaultValue="floating">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="floating">Плавающая</TabsTrigger>
                    <TabsTrigger value="button">Кнопка</TabsTrigger>
                    <TabsTrigger value="iframe">Iframe</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="floating" className="space-y-4 pt-4">
                    <div className="bg-slate-900 rounded-lg p-4 relative group">
                      <pre className="text-[10px] text-blue-300 overflow-x-auto">
{`<script 
  src="${window.location.origin}/widget.js"
  data-business="${slug}"
  data-color="#2563eb"
  data-position="bottom-right">
</script>`}
                      </pre>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="absolute top-2 right-2 text-slate-400 hover:text-white"
                        onClick={() => {
                          navigator.clipboard.writeText(`<script src="${window.location.origin}/widget.js" data-business="${slug}" data-color="#2563eb" data-position="bottom-right"></script>`);
                          toast.success('Код скопирован');
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500 italic">
                      💡 Вставьте этот код перед закрывающим тегом &lt;/body&gt; на вашем сайте.
                    </p>
                  </TabsContent>

                  <TabsContent value="button" className="space-y-4 pt-4">
                    <div className="bg-slate-900 rounded-lg p-4 relative">
                      <pre className="text-[10px] text-blue-300 overflow-x-auto">
{`<a href="${window.location.origin}/book/${slug}" 
   style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-family:sans-serif;font-weight:600;">
  Записаться онлайн
</a>`}
                      </pre>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="absolute top-2 right-2 text-slate-400 hover:text-white"
                        onClick={() => {
                          navigator.clipboard.writeText(`<a href="${window.location.origin}/book/${slug}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-family:sans-serif;font-weight:600;">Записаться онлайн</a>`);
                          toast.success('Код кнопки скопирован');
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="iframe" className="space-y-4 pt-4">
                    <div className="bg-slate-900 rounded-lg p-4 relative">
                      <pre className="text-[10px] text-blue-300 overflow-x-auto">
{`<iframe 
  src="${window.location.origin}/book/${slug}?embed=true" 
  width="100%" 
  height="700" 
  frameborder="0">
</iframe>`}
                      </pre>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="absolute top-2 right-2 text-slate-400 hover:text-white"
                        onClick={() => {
                          navigator.clipboard.writeText(`<iframe src="${window.location.origin}/book/${slug}?embed=true" width="100%" height="700" frameborder="0"></iframe>`);
                          toast.success('Код iframe скопирован');
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </TabsContent>
        </div>
      </div>
    </Tabs>
  );
}
