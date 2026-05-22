import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Calendar, Clock, Scissors, Check, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function RebookPage() {
  const { hash } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`/api/rebook/${hash}`);
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [hash]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await axios.post(`/api/rebook/${hash}/confirm`);
      setSuccess(true);
      toast.success('Запись подтверждена!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка подтверждения');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20">Загрузка предложения...</div>;
  if (!data) return <div className="flex justify-center p-20 text-slate-500">Предложение не найдено или уже не актуально</div>;

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center py-10">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={40} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Готово!</h2>
          <p className="text-slate-600 mb-8">Вы успешно записались на повторный визит.</p>
          <Button onClick={() => window.location.href = '/profile'}>Перейти в профиль</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Scissors size={32} />
          </div>
          <CardTitle className="text-2xl">С возвращением!</CardTitle>
          <CardDescription>
            Мы подобрали для вас удобное время для повторного визита в {data.business.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-blue-600" />
              <span className="font-semibold">{format(new Date(data.suggestedSlot.date), 'd MMMM, EEEE', { locale: ru })}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-600" />
              <span className="font-semibold">{data.suggestedSlot.time}</span>
            </div>
            <div className="flex items-center gap-3">
              <Scissors className="w-5 h-5 text-slate-400" />
              <span>{data.service.name}</span>
            </div>
            <div className="pt-2 border-t flex justify-between items-center">
              <span className="text-sm text-slate-500">Мастер</span>
              <span className="font-medium">{data.staff.name}</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700" onClick={handleConfirm} disabled={confirming}>
              {confirming ? <Loader2 className="animate-spin mr-2" /> : 'Подтвердить запись'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => window.location.href = `/book/${data.business.slug}`}>
              Выбрать другое время
            </Button>
          </div>

          <p className="text-[10px] text-center text-slate-400">
            Нажимая кнопку, вы подтверждаете запись на указанное время.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
