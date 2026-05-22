import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function BookingConfirmation() {
  const { hash } = useParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const confirm = async () => {
      try {
        await axios.get(`/b/${hash}/confirm`);
        setStatus('success');
      } catch (error) {
        setStatus('error');
      }
    };
    confirm();
  }, [hash]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-6">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <h2 className="text-xl font-bold">Подтверждение записи...</h2>
          </div>
        )}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            <h2 className="text-2xl font-bold text-gray-900">Запись подтверждена!</h2>
            <p className="text-gray-500">Мы ждем вас в назначенное время. Спасибо, что выбрали нас!</p>
            <Link to="/" className={cn(buttonVariants(), "w-full bg-blue-600")}>
              На главную
            </Link>
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-16 h-16 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900">Ошибка подтверждения</h2>
            <p className="text-gray-500">Ссылка недействительна или срок ее действия истек.</p>
            <Link to="/" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
              На главную
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
