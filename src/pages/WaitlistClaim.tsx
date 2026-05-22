import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function WaitlistClaim() {
  const { hash } = useParams();
  const [status, setStatus] = useState<'loading' | 'confirming' | 'success' | 'error'>('confirming');
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await axios.get(`/w/${hash}`);
        setDetails(res.data);
      } catch (error) {
        setStatus('error');
      }
    };
    fetchDetails();
  }, [hash]);

  const handleClaim = async () => {
    setStatus('loading');
    try {
      await axios.post(`/w/${hash}/claim`);
      setStatus('success');
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center space-y-6">
        {status === 'confirming' && details && (
          <div className="flex flex-col items-center gap-4">
            <Sparkles className="w-16 h-16 text-blue-500" />
            <h2 className="text-2xl font-bold text-gray-900">Освободилось место!</h2>
            <p className="text-gray-500">
              Появилось свободное время на услугу <b>{details.service.name}</b>: 
              <br />
              <span className="text-blue-600 font-bold">{details.time}</span>
            </p>
            <Button className="w-full bg-blue-600 h-12 text-lg" onClick={handleClaim}>Занять это время</Button>
            <p className="text-[10px] text-gray-400">Поспешите, место может занять кто-то другой!</p>
          </div>
        )}
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <h2 className="text-xl font-bold">Бронирование места...</h2>
          </div>
        )}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            <h2 className="text-2xl font-bold text-gray-900">Успешно!</h2>
            <p className="text-gray-500">Вы успешно заняли освободившееся время. Ждем вас!</p>
            <Link to="/" className={cn(buttonVariants(), "w-full bg-blue-600")}>
              На главную
            </Link>
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-16 h-16 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-900">Упс!</h2>
            <p className="text-gray-500">Это место уже занято или ссылка недействительна.</p>
            <Link to="/" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
              На главную
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
