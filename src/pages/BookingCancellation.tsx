import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function BookingCancellation() {
  const { hash } = useParams();
  const [status, setStatus] = useState<'loading' | 'confirming' | 'success' | 'error'>('confirming');

  const handleCancel = async () => {
    setStatus('loading');
    try {
      await axios.get(`/b/${hash}/cancel`);
      setStatus('success');
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-6">
        {status === 'confirming' && (
          <div className="flex flex-col items-center gap-4">
            <AlertTriangle className="w-16 h-16 text-amber-500" />
            <h2 className="text-2xl font-bold text-gray-900">Отмена записи</h2>
            <p className="text-gray-500">Вы действительно хотите отменить вашу запись?</p>
            <div className="flex gap-4 w-full">
              <Link to="/" className={cn(buttonVariants({ variant: "outline" }), "flex-1")}>
                Нет, оставить
              </Link>
              <Button variant="destructive" className="flex-1" onClick={handleCancel}>Да, отменить</Button>
            </div>
          </div>
        )}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <h2 className="text-xl font-bold">Отмена записи...</h2>
          </div>
        )}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            <h2 className="text-2xl font-bold text-gray-900">Запись отменена</h2>
            <p className="text-gray-500">Ваша запись успешно отменена. Надеемся увидеть вас в другой раз!</p>
            <Link to="/">
              <Button className="w-full bg-blue-600">На главную</Button>
            </Link>
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-16 h-16 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900">Ошибка отмены</h2>
            <p className="text-gray-500">Не удалось отменить запись. Возможно, она уже отменена или ссылка недействительна.</p>
            <Link to="/">
              <Button variant="outline" className="w-full">На главную</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
