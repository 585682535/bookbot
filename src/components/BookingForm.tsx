import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, addDays, isSameDay, startOfWeek, subDays, parse, isAfter, addMinutes } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Check, ChevronRight, ChevronLeft, Clock, User, Scissors, Calendar as CalendarIcon, Phone, Mail, Ticket, CreditCard, Download, Star, Loader2, AlertCircle, CalendarDays, Users, Gift, Send, Sun, Sunrise, Moon } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { toast } from 'sonner';
import { WeeklySchedule } from './WeeklySchedule';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  description?: string;
}

interface Staff {
  id: string;
  name: string;
}

interface Business {
  id: string;
  name: string;
  slug: string;
  address?: string;
  services: Service[];
  staff: Staff[];
}

export function BookingForm({ slug }: { slug: string }) {
  const [step, setStep] = useState(1);
  const [business, setBusiness] = useState<Business | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [clientInfo, setClientInfo] = useState({ 
    name: '', 
    phone: '', 
    email: '', 
    notes: '',
    bookedForSelf: true,
    bookedByName: '',
    bookedByPhone: '',
    bookedByEmail: '',
    relationship: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [promocode, setPromocode] = useState('');
  const [promoData, setPromoData] = useState<any>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [giftCode, setGiftCode] = useState('');
  const [giftData, setGiftData] = useState<any>(null);
  const [isApplyingGift, setIsApplyingGift] = useState(false);
  const [clientSubscriptions, setClientSubscriptions] = useState<any[]>([]);
  const [clientLoyaltyPoints, setClientLoyaltyPoints] = useState(0);
  const [pointsSpent, setPointsSpent] = useState(0);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [flowType, setFlowType] = useState<'service' | 'date' | 'master'>('service');
  const [nextAvailable, setNextAvailable] = useState<any>(null);
  const [allSlots, setAllSlots] = useState<any[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) setReferralCode(ref);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('clientToken');
    if (token) {
      const fetchProfile = async () => {
        try {
          const res = await axios.get('/api/clients/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const profile = res.data;
          if (profile) {
            setClientInfo(prev => ({
              ...prev,
              name: profile.name || '',
              phone: profile.phone || '',
              email: profile.email || ''
            }));
            setClientLoyaltyPoints(profile.loyaltyPoints || 0);
            
            // Also fetch subscriptions
            const subsRes = await axios.get('/api/clients/me/subscriptions', {
              headers: { Authorization: `Bearer ${token}` }
            });
            setClientSubscriptions(subsRes.data);
          }
        } catch (err) {
          console.error("Error fetching client profile for booking:", err);
        }
      };
      fetchProfile();
    }
  }, []);

  useEffect(() => {
    const isWidget = new URLSearchParams(window.location.search).get('widget') === 'true';
    if (step === 6 && isWidget && bookingResult) {
      window.parent.postMessage({
        type: 'bookbot:booking-complete',
        booking: bookingResult
      }, '*');
    }
  }, [step, bookingResult]);

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const res = await axios.get(`/api/businesses/${slug}`);
        setBusiness(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchBusiness();
  }, [slug]);

  useEffect(() => {
    if (business?.id) {
      const fetchReviews = async () => {
        try {
          const res = await axios.get(`/api/reviews`, {
            params: { businessId: business.id, status: 'approved' }
          });
          setReviews(res.data);
        } catch (err) {
          console.error(err);
        }
      };
      fetchReviews();
    }
  }, [business?.id]);

  useEffect(() => {
    if (selectedDate && (flowType === 'service' || flowType === 'master') && selectedService) {
      const fetchSlots = async () => {
        setIsLoadingSlots(true);
        try {
          const res = await axios.get(`/api/businesses/${slug}/slots`, {
            params: {
              date: format(selectedDate, 'yyyy-MM-dd'),
              serviceId: selectedService.id,
              staffId: selectedStaff?.id
            }
          });
          setAvailableSlots(res.data.slots);
          setNextAvailable(res.data.nextAvailable);
        } catch (err) {
          console.error(err);
        } finally {
          setIsLoadingSlots(false);
        }
      };
      fetchSlots();
    } else if (selectedDate && flowType === 'date') {
      const fetchAllSlots = async () => {
        setIsLoadingSlots(true);
        try {
          const res = await axios.get(`/api/businesses/${slug}/all-slots`, {
            params: { date: format(selectedDate, 'yyyy-MM-dd') }
          });
          setAllSlots(res.data);
        } catch (err) {
          console.error(err);
        } finally {
          setIsLoadingSlots(false);
        }
      };
      fetchAllSlots();
    }
  }, [selectedDate, selectedService, selectedStaff, slug, flowType]);

  const checkExistingClient = async (phone: string) => {
    if (phone.length < 10) return;
    try {
      const res = await axios.post('/api/clients/lookup', { phone });
      if (res.data.found) {
        setClientInfo(prev => ({ ...prev, name: res.data?.name || '', email: res.data?.email || '' }));
        toast.success(res.data.message);
        
        // Fetch subscriptions for this client
        try {
          const subsRes = await axios.get(`/api/clients/${res.data.id}/subscriptions`);
          setClientSubscriptions(subsRes.data);
        } catch (e) {
          console.error("Error fetching subscriptions:", e);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const applyGiftCertificate = async () => {
    if (!giftCode) return;
    setIsApplyingGift(true);
    try {
      const res = await axios.post('/api/gift-certificates/apply', { code: giftCode });
      setGiftData(res.data);
      toast.success(res.data.message);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Ошибка применения сертификата');
      setGiftData(null);
    } finally {
      setIsApplyingGift(false);
    }
  };

  const handleBooking = async () => {
    if (!business || !selectedService || !selectedDate || !selectedTime) return;
    
    setIsBooking(true);
    try {
      const startTime = format(selectedDate, 'yyyy-MM-dd') + 'T' + selectedTime + ':00';
      const res = await axios.post('/api/bookings', {
        businessId: business.id,
        serviceId: selectedService.id,
        staffId: selectedStaff?.id || null,
        startTime,
        ...clientInfo,
        source: 'WIDGET',
        promocodeId: promoData?.promocodeId,
        subscriptionPurchaseId: selectedSubscriptionId,
        giftCertificateCode: giftData?.valid ? giftCode : null,
        referralCode,
        pointsSpent: pointsSpent > 0 ? pointsSpent : undefined
      });
      
      const booking = res.data;
      setBookingResult(booking);

      if ((business as any).paymentEnabled) {
        const payRes = await axios.post(`/api/bookings/${booking.id}/create-payment`);
        window.location.href = payRes.data.paymentUrl;
      } else {
        setStep(6);
      }
    } catch (err: any) {
      console.error(err);
      const errorData = err.response?.data;
      const errorMsg = errorData?.error || "Ошибка при создании записи. Возможно, время уже занято.";
      const details = errorData?.details ? `\n\nПодробности: ${errorData.details}` : "";
      alert(`${errorMsg}${details}`);
    } finally {
      setIsBooking(false);
    }
  };

  const applyPromocode = async () => {
    if (!promocode || !selectedService || !business) return;
    setPromoError('');
    setPromoData(null);
    setIsApplyingPromo(true);
    try {
      const res = await axios.post('/api/promocodes/validate', {
        code: promocode,
        serviceId: selectedService.id,
        originalPrice: selectedService.price,
        businessId: business.id
      });
      setPromoData(res.data);
      toast.success(res.data.message);
    } catch (err: any) {
      setPromoError(err.response?.data?.error || 'Ошибка проверки промокода');
      setPromoData(null);
    } finally {
      setIsApplyingPromo(false);
    }
  };

  const renderGroupedSlots = (slots: any[], onSelect: (time: string) => void, showStaffCount = false) => {
    const morning = slots.filter(s => { 
      const hour = parseInt((s.time || s.start).split(':')[0]); 
      return hour < 12; 
    });
    const afternoon = slots.filter(s => { 
      const hour = parseInt((s.time || s.start).split(':')[0]); 
      return hour >= 12 && hour < 17; 
    });
    const evening = slots.filter(s => { 
      const hour = parseInt((s.time || s.start).split(':')[0]); 
      return hour >= 17; 
    });

    const sections = [
      { title: 'Утро', icon: <Sunrise className="w-4 h-4 text-orange-400" />, items: morning },
      { title: 'День', icon: <Sun className="w-4 h-4 text-yellow-500" />, items: afternoon },
      { title: 'Вечер', icon: <Moon className="w-4 h-4 text-blue-400" />, items: evening },
    ].filter(s => s.items.length > 0);

    return (
      <div className="space-y-6 w-full">
        {sections.map(section => (
          <div key={section.title} className="space-y-3 w-full">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
              {section.icon}
              <span>{section.title}</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {section.items.map(slot => {
                const time = slot.time || slot.start;
                return (
                  <Button 
                    key={time} 
                    variant="outline" 
                    onClick={() => onSelect(time)}
                    className="flex flex-col h-auto py-3 px-1 rounded-2xl border-slate-200 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all active:scale-95 shadow-sm bg-white"
                  >
                    <span className="font-bold text-sm tracking-tight">{time}</span>
                    {showStaffCount && slot.availableStaff && (
                      <span className="text-[9px] opacity-70 font-medium">{slot.availableStaff.length} маст.</span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) return <div className="flex justify-center p-20">Загрузка...</div>;
  if (!business) return <div className="flex justify-center p-20">Бизнес не найден</div>;

  return (
    <div className="max-w-2xl mx-auto p-3 sm:p-4">
      <div className="mb-6 md:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/50 p-4 rounded-3xl backdrop-blur-sm border border-white/50">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{business.name}</h1>
          <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest">Онлайн-запись</p>
        </div>
        <div className="flex gap-1 sm:gap-1.5 px-1 sm:px-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div 
              key={i} 
              className={`h-1 sm:h-1.5 w-4 sm:w-6 rounded-full transition-all duration-500 ${step >= i ? 'bg-blue-600 w-6 sm:w-10' : 'bg-slate-200'}`} 
            />
          ))}
        </div>
      </div>

      {step === 1 && (
        <Tabs value={flowType} onValueChange={(v: any) => setFlowType(v)} className="mb-8 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 h-14 rounded-2xl bg-slate-100/80 p-1.5 border border-slate-200/50 shadow-inner">
            <TabsTrigger value="service" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg h-full font-bold transition-all">
              <Scissors className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">По услуге</span>
            </TabsTrigger>
            <TabsTrigger value="date" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg h-full font-bold transition-all">
              <CalendarDays className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">По дате</span>
            </TabsTrigger>
            <TabsTrigger value="master" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg h-full font-bold transition-all">
              <User className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">По мастеру</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <AnimatePresence mode="wait">
        {step === 1 && flowType === 'service' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scissors className="text-blue-600" /> Выберите услугу
                </CardTitle>
                <CardDescription>Выберите одну или несколько услуг для записи</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(business.services || []).map(service => (
                  <div 
                    key={service.id} 
                    onClick={() => { setSelectedService(service); setStep(2); }}
                    className="flex justify-between items-center p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition-all group"
                  >
                    <div>
                      <h3 className="font-semibold text-slate-900 group-hover:text-blue-700">{service.name}</h3>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <Clock size={14} /> {service.durationMinutes} мин
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{service.price} ₽</p>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 ml-auto" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {reviews.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-900 px-2">Отзывы клиентов</h3>
                <div className="space-y-3">
                  {reviews.map((review) => (
                    <Card key={review.id} className="rounded-2xl border-none shadow-sm bg-white">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                              {review.client?.name?.[0] || '?'}
                            </div>
                            <span className="font-semibold text-sm">{review.client?.name || 'Аноним'}</span>
                          </div>
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star key={s} className={`w-3 h-3 ${review.rating >= s ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-slate-600">{review.text}</p>
                        {review.businessReply && (
                          <div className="bg-slate-50 p-3 rounded-xl text-xs border-l-2 border-blue-400">
                            <p className="font-bold text-slate-900 mb-1">Ответ владельца:</p>
                            <p className="text-slate-600">{review.businessReply}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {step === 1 && flowType === 'date' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full">
            <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-md rounded-[2.5rem] overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <CalendarIcon className="text-blue-600" /> Когда вам удобно?
                </CardTitle>
                <CardDescription className="text-slate-500 font-medium tracking-wide uppercase text-[10px]">Выберите подходящую дату</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center p-6">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => setSelectedDate(date)}
                  disabled={(date) => date < addDays(new Date(), -1)}
                  className="rounded-3xl border border-slate-100 shadow-inner bg-white/50 mb-8 p-4"
                  locale={ru}
                />
                
                {selectedDate && (
                  <div className="w-full space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="font-bold text-sm text-slate-800 tracking-tight">
                        Доступно {format(selectedDate, 'd MMMM', { locale: ru })}
                      </h3>
                    </div>
                    {isLoadingSlots ? (
                      <div className="flex flex-col items-center py-8 gap-2">
                        <Loader2 className="animate-spin text-blue-600 opacity-40" />
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Проверяем...</span>
                      </div>
                    ) : allSlots.length > 0 ? (
                      renderGroupedSlots(allSlots, (time) => { setSelectedTime(time); setStep(2); }, true)
                    ) : (
                      <div className="text-center py-10 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                        <p className="text-sm text-slate-400 font-medium">К сожалению, на этот день мест нет</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 1 && flowType === 'master' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="text-blue-600" /> К кому хотите записаться?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {business.staff.map(staff => (
                  <div 
                    key={staff.id} 
                    onClick={() => { setSelectedStaff(staff); setStep(2); }}
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition-all"
                  >
                    <Avatar className="w-12 h-12 border-2 border-white shadow-sm">
                      <AvatarFallback className="bg-blue-100 text-blue-600 font-bold">{staff.name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-slate-900">{staff.name || 'Мастер'}</h3>
                      <p className="text-xs text-slate-500">Свободен сегодня</p>
                    </div>
                    <ChevronRight size={18} className="text-slate-300 ml-auto" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && flowType === 'service' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="text-blue-600" /> Выберите мастера
                </CardTitle>
                <CardDescription>Вы можете выбрать конкретного мастера или любого свободного</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div 
                  onClick={() => { setSelectedStaff(null); setStep(3); }}
                  className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <User size={24} />
                  </div>
                  <span className="font-semibold">Любой свободный мастер</span>
                </div>
                {business.staff.map(staff => (
                  <div 
                    key={staff.id} 
                    onClick={() => { setSelectedStaff(staff); setStep(3); }}
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                      {staff.name?.[0] || '?'}
                    </div>
                    <span className="font-semibold">{staff.name || 'Мастер'}</span>
                  </div>
                ))}
                <Button variant="ghost" onClick={() => setStep(1)} className="w-full mt-4">Назад</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && flowType === 'date' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="text-blue-600" /> Кто вам подойдет?
                </CardTitle>
                <CardDescription>Мастера, свободные в {selectedTime} {format(selectedDate!, 'd MMMM', { locale: ru })}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {allSlots.find(s => s.time === selectedTime)?.availableStaff.map((staff: any) => (
                  <div 
                    key={staff.id} 
                    onClick={() => { setSelectedStaff(staff); setStep(3); }}
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition-all"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-blue-100 text-blue-600 font-bold">{staff.name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold">{staff.name || 'Мастер'}</span>
                    <ChevronRight size={18} className="text-slate-300 ml-auto" />
                  </div>
                ))}
                <Button variant="ghost" onClick={() => setStep(1)} className="w-full mt-4">Назад</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && flowType === 'master' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="text-blue-600" /> Расписание мастера {selectedStaff?.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <WeeklySchedule 
                  businessSlug={slug} 
                  staffId={selectedStaff?.id!} 
                  onSelectSlot={(date, time) => {
                    setSelectedDate(date);
                    setSelectedTime(time);
                    setStep(3);
                  }}
                />
                <Button variant="ghost" onClick={() => setStep(1)} className="w-full mt-4">Назад</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 3 && flowType === 'service' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="text-blue-600" /> Выберите дату
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => { setSelectedDate(date); setStep(4); }}
                  disabled={(date) => date < addDays(new Date(), -1)}
                  className="rounded-md border shadow-sm"
                  locale={ru}
                />
                <Button variant="ghost" onClick={() => setStep(2)} className="w-full mt-4">Назад</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 3 && (flowType === 'date' || flowType === 'master') && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scissors className="text-blue-600" /> Какая услуга?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(business.services || []).map(service => (
                  <div 
                    key={service.id} 
                    onClick={() => { setSelectedService(service); setStep(5); }}
                    className="flex justify-between items-center p-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer transition-all group"
                  >
                    <div>
                      <h3 className="font-semibold text-slate-900 group-hover:text-blue-700">{service.name}</h3>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <Clock size={14} /> {service.durationMinutes} мин
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">{service.price} ₽</p>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 ml-auto" />
                    </div>
                  </div>
                ))}
                <Button variant="ghost" onClick={() => setStep(2)} className="w-full mt-4">Назад</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full">
            <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/80 backdrop-blur-md rounded-[2.5rem] overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Clock className="text-blue-600" /> Свободное время
                </CardTitle>
                <CardDescription className="text-slate-500 font-medium">
                  {format(selectedDate!, 'd MMMM', { locale: ru })}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-2">
                <Tabs defaultValue="day" className="w-full flex flex-col gap-6">
                  <TabsList className="grid w-full grid-cols-2 h-14 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50">
                    <TabsTrigger value="day" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all h-full font-semibold">На один день</TabsTrigger>
                    <TabsTrigger value="week" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-md transition-all h-full font-semibold">На неделю</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="day" className="m-0 pt-0 outline-none w-full">
                    {isLoadingSlots ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="animate-spin text-blue-600 w-8 h-8 opacity-50" />
                        <span className="text-sm text-slate-400">Ищем свободные окна...</span>
                      </div>
                    ) : availableSlots.length > 0 ? (
                      renderGroupedSlots(availableSlots, (time) => { setSelectedTime(time); setStep(5); })
                    ) : nextAvailable ? (
                      <Alert className="bg-blue-50 border-blue-200">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-blue-900">На этот день мест нет</AlertTitle>
                        <AlertDescription className="text-blue-700 mt-2">
                          <p className="mb-4">{nextAvailable.message}</p>
                          <Button 
                            size="sm" 
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={() => {
                              setSelectedDate(new Date(nextAvailable.date));
                              setSelectedTime(nextAvailable.time);
                              if (nextAvailable.staffId !== selectedStaff?.id) {
                                const staff = business.staff.find(s => s.id === nextAvailable.staffId);
                                if (staff) setSelectedStaff(staff);
                              }
                              setStep(5);
                            }}
                          >
                            Записаться на {nextAvailable.time}
                          </Button>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="text-center py-8 text-slate-500">Нет свободных слотов в ближайшее время</div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="week">
                    <WeeklySchedule 
                      businessSlug={slug} 
                      staffId={selectedStaff?.id || business.staff[0]?.id} 
                      onSelectSlot={(date, time) => {
                        setSelectedDate(date);
                        setSelectedTime(time);
                        setStep(5);
                      }}
                    />
                  </TabsContent>
                </Tabs>
                <Button variant="ghost" onClick={() => setStep(3)} className="w-full mt-4">Назад</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 5 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="text-blue-600" /> Контактные данные
                </CardTitle>
                <CardDescription>Оставьте ваши контакты для подтверждения записи</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4 border-b pb-4 mb-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <Users className="w-4 h-4 text-blue-600" />
                      Записываю другого человека
                    </Label>
                    <Switch 
                      checked={!clientInfo.bookedForSelf} 
                      onCheckedChange={(checked) => setClientInfo({...clientInfo, bookedForSelf: !checked})}
                    />
                  </div>
                  
                  {!clientInfo.bookedForSelf && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-3 pt-2 overflow-hidden">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Имя гостя</Label>
                          <Input size={32} value={clientInfo.name} onChange={e => setClientInfo({...clientInfo, name: e.target.value})} placeholder="Имя" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Ваше имя (кто записывает)</Label>
                          <Input size={32} value={clientInfo.bookedByName} onChange={e => setClientInfo({...clientInfo, bookedByName: e.target.value})} placeholder="Ваше имя" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Ваш телефон</Label>
                        <Input value={clientInfo.bookedByPhone} onChange={e => setClientInfo({...clientInfo, bookedByPhone: e.target.value})} placeholder="+7..." />
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{clientInfo.bookedForSelf ? 'Ваш телефон' : 'Телефон гостя'}</Label>
                  <Input 
                    id="phone" 
                    value={clientInfo.phone} 
                    onChange={e => setClientInfo({...clientInfo, phone: e.target.value})} 
                    onBlur={e => checkExistingClient(e.target.value)}
                    placeholder="+7 (999) 000-00-00" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Ваше имя</Label>
                  <Input id="name" value={clientInfo.name} onChange={e => setClientInfo({...clientInfo, name: e.target.value})} placeholder="Иван Иванов" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (опционально)</Label>
                  <Input id="email" value={clientInfo.email} onChange={e => setClientInfo({...clientInfo, email: e.target.value})} placeholder="example@mail.ru" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Комментарий</Label>
                  <Input id="notes" value={clientInfo.notes} onChange={e => setClientInfo({...clientInfo, notes: e.target.value})} placeholder="Особые пожелания..." />
                </div>
                
                <Alert className="bg-slate-50 border-slate-200 py-2">
                  <AlertDescription className="text-[10px] text-slate-500">
                    💡 Это НЕ регистрация. Мы просто запомним вас для следующего раза.
                  </AlertDescription>
                </Alert>

                {clientSubscriptions.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <Label className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-blue-600" />
                      Ваши абонементы
                    </Label>
                    <div className="grid grid-cols-1 gap-2">
                      {clientSubscriptions.map((sub: any) => (
                        <div 
                          key={sub.id}
                          onClick={() => setSelectedSubscriptionId(selectedSubscriptionId === sub.id ? null : sub.id)}
                          className={cn(
                            "p-3 border rounded-xl cursor-pointer transition-all flex justify-between items-center",
                            selectedSubscriptionId === sub.id ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600" : "hover:border-blue-200"
                          )}
                        >
                          <div>
                            <p className="text-sm font-semibold">{sub.subscription?.name || 'Удаленный абонемент'}</p>
                            <p className="text-[10px] text-slate-500">Осталось: {sub.remainingVisits} из {sub.subscription?.totalVisits || 0}</p>
                          </div>
                          {selectedSubscriptionId === sub.id && <Check className="w-4 h-4 text-blue-600" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2 pt-4">
                  <Label className="flex items-center gap-2">
                    <Gift className="w-4 h-4 text-purple-600" />
                    Подарочный сертификат
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Код сертификата" 
                      value={giftCode} 
                      onChange={e => setGiftCode(e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                    <Button type="button" variant="outline" onClick={applyGiftCertificate} disabled={isApplyingGift}>
                      {isApplyingGift ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Применить'}
                    </Button>
                  </div>
                  {giftData && (
                    <p className="text-xs text-purple-600 font-medium flex items-center gap-1">
                      <Check size={12} /> Сертификат на {giftData.amount} ₽ применен
                    </p>
                  )}
                </div>

                <div className="space-y-2 pt-4">
                  <Label>Промокод</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="SALE20" 
                      value={promocode} 
                      onChange={e => setPromocode(e.target.value.toUpperCase())}
                      className={cn("uppercase", promoData ? 'border-green-500' : '')}
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={applyPromocode} 
                      disabled={!promocode || isApplyingPromo}
                    >
                      {isApplyingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Применить'}
                    </Button>
                  </div>
                  
                  {promoError && (
                    <p className="text-sm text-red-500">{promoError}</p>
                  )}
                  
                  {promoData && (
                    <Alert className="bg-green-50 border-green-200 text-green-800">
                      <Check className="w-4 h-4 text-green-600" />
                      <AlertDescription>
                        {promoData.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {business && (business as any).loyaltyEnabled && clientLoyaltyPoints > 0 && !selectedSubscriptionId && (
                  <div className="space-y-4 pt-4 pb-4 border-b border-slate-100">
                     <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-2">
                           <Gift className="w-4 h-4 text-emerald-600" />
                           Использовать баллы ({clientLoyaltyPoints})
                        </Label>
                        <Switch 
                          checked={pointsSpent > 0} 
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const basePrice = selectedService?.price || 0;
                              const currentDiscount = (promoData?.discountAmount || 0) + (giftData?.amount || 0);
                              const maxDiscountByPercent = Math.floor((basePrice - currentDiscount) * ((business as any).loyaltyMaxSpend / 100));
                              const possibleToSpend = Math.min(clientLoyaltyPoints, maxDiscountByPercent, basePrice - currentDiscount);
                              setPointsSpent(possibleToSpend);
                            } else {
                              setPointsSpent(0);
                            }
                          }}
                        />
                     </div>
                     
                     {pointsSpent > 0 && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                           <div className="flex items-center gap-4">
                              <Input 
                                type="number" 
                                value={pointsSpent} 
                                onChange={(e) => {
                                  let val = parseInt(e.target.value) || 0;
                                  const basePrice = selectedService?.price || 0;
                                  const currentDiscount = (promoData?.discountAmount || 0) + (giftData?.amount || 0);
                                  const maxDiscountByPercent = Math.floor((basePrice - currentDiscount) * ((business as any).loyaltyMaxSpend / 100));
                                  val = Math.min(val, clientLoyaltyPoints, maxDiscountByPercent, basePrice - currentDiscount);
                                  setPointsSpent(val);
                                }}
                                className="h-10 rounded-xl"
                              />
                              <span className="text-xs text-slate-400 font-bold uppercase shrink-0">баллов</span>
                           </div>
                           <p className="text-[10px] text-slate-500 italic">
                             * Максимум можно списать {(business as any).loyaltyMaxSpend}% от суммы (после других скидок)
                           </p>
                        </div>
                     )}
                  </div>
                )}
                
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mt-6">
                  <h4 className="font-semibold text-sm text-slate-900 mb-2">Детали записи:</h4>
                  <div className="text-sm space-y-1 text-slate-600">
                    <div className="flex justify-between">
                      <span>Услуга:</span>
                      <span className="text-slate-900 font-medium">{selectedService?.name}</span>
                    </div>
                    <p>Дата: <span className="text-slate-900 font-medium">{format(selectedDate!, 'd MMMM', { locale: ru })} в {selectedTime}</span></p>
                    <p>Мастер: <span className="text-slate-900 font-medium">{selectedStaff?.name || 'Любой свободный'}</span></p>
                    
                    {promoData || giftData || pointsSpent > 0 ? (
                      <>
                        <div className="flex justify-between text-slate-400">
                          <span>Цена:</span>
                          <span className="line-through">{selectedService?.price} ₽</span>
                        </div>
                        {promoData && (
                          <div className="flex justify-between text-green-600">
                            <span>Промокод:</span>
                            <span>-{promoData.discountAmount} ₽</span>
                          </div>
                        )}
                        {giftData && (
                          <div className="flex justify-between text-purple-600">
                            <span>Сертификат:</span>
                            <span>-{giftData.amount} ₽</span>
                          </div>
                        )}
                        {pointsSpent > 0 && (
                          <div className="flex justify-between text-emerald-600">
                            <span>Баллы:</span>
                            <span>-{pointsSpent} ₽</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-slate-200">
                          <span className="text-slate-900">Итого:</span>
                          <span className="text-blue-600">
                            {Math.max(0, (selectedService?.price || 0) - (promoData?.discountAmount || 0) - (giftData?.amount || 0) - pointsSpent)} ₽
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-slate-200">
                        <span className="text-slate-900">Итого:</span>
                        <span className="text-blue-600">{selectedService?.price} ₽</span>
                      </div>
                    )}
                    
                    {(business as any).requirePrepayment && (business as any).paymentEnabled && (
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mt-2">
                        <p className="text-xs text-blue-700 flex items-center gap-1">
                          <CreditCard size={12} /> Требуется предоплата: {((promoData ? promoData.finalPrice : selectedService!.price) * (business as any).prepaymentPercent / 100).toFixed(0)} ₽ ({(business as any).prepaymentPercent}%)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-lg h-14 rounded-2xl shadow-lg shadow-blue-100" 
                  onClick={handleBooking}
                  disabled={!clientInfo.name || !clientInfo.phone || isBooking}
                >
                  {isBooking ? 'Оформление...' : (business as any).paymentEnabled ? 'Оплатить и записаться' : 'Подтвердить запись'}
                </Button>
                <Button variant="ghost" onClick={() => setStep(4)} className="w-full">Назад</Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 6 && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Card className="border-green-100 bg-green-50/30">
              <CardContent className="pt-10 pb-10 text-center">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check size={40} strokeWidth={3} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Запись успешно создана!</h2>
                <p className="text-slate-600 mb-8">Мы отправили вам подтверждение. Ждем вас!</p>
                
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 text-left mb-8">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Номер записи</p>
                      <p className="font-mono font-bold text-slate-900">#{bookingResult?.id.slice(-6).toUpperCase()}</p>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Подтверждено</Badge>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <CalendarIcon size={18} className="text-slate-400" />
                      <span className="text-slate-700">{format(selectedDate!, 'd MMMM yyyy', { locale: ru })}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Clock size={18} className="text-slate-400" />
                      <span className="text-slate-700">{selectedTime} ({selectedService?.durationMinutes} мин)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Scissors size={18} className="text-slate-400" />
                      <span className="text-slate-700 font-medium">{selectedService?.name}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mb-8">
                  <Button 
                    className="w-full h-12 rounded-xl" 
                    variant="outline"
                    onClick={() => window.open(`/api/bookings/${bookingResult?.id}/calendar`)}
                  >
                    <Download className="w-4 h-4 mr-2" /> Добавить в календарь (.ics)
                  </Button>
                  <Button 
                    className="w-full h-12 rounded-xl" 
                    variant="outline"
                    onClick={() => {
                      const start = format(selectedDate!, 'yyyyMMdd') + 'T' + selectedTime?.replace(':', '') + '00Z';
                      const end = format(selectedDate!, 'yyyyMMdd') + 'T' + format(addMinutes(parse(selectedTime!, 'HH:mm', new Date()), selectedService!.durationMinutes), 'HHmm') + '00Z';
                      const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(selectedService?.name || 'Запись')}&dates=${start}/${end}&details=${encodeURIComponent(`Мастер: ${selectedStaff?.name || 'Любой'}`)}&location=${encodeURIComponent(business.address || '')}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <CalendarIcon className="w-4 h-4 mr-2" /> Google Calendar
                  </Button>
                </div>

                <Button className="w-full" variant="outline" onClick={() => window.location.reload()}>
                  Создать еще одну запись
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
