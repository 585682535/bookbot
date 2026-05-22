import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, CheckCircle2, Loader2, Camera } from 'lucide-react';
import { toast } from 'sonner';

export default function ReviewPage() {
  const { hash } = useParams();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking-by-hash', hash],
    queryFn: async () => {
      const res = await axios.get(`/api/bookings/by-hash/${hash}`);
      return res.data;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      await axios.post('/api/reviews', data);
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success('Спасибо за ваш отзыв!');
    },
    onError: () => {
      toast.error('Ошибка при отправке отзыва');
    },
  });

  const addPhoto = () => {
    // Симуляция загрузки фото
    const mockUrl = `https://picsum.photos/seed/${Math.random()}/800/600`;
    setPhotos([...photos, mockUrl]);
    toast.info('Фото добавлено (симуляция)');
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <h2 className="text-xl font-bold">Запись не найдена</h2>
          <p className="text-slate-500 mt-2">Возможно, ссылка устарела или неверна.</p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-12 space-y-4 rounded-3xl shadow-xl">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold">Отзыв отправлен!</h2>
          <p className="text-slate-500">
            Спасибо, что помогаете нам становиться лучше. Ваш отзыв будет опубликован после модерации.
          </p>
          <Button className="w-full rounded-xl" onClick={() => window.close()}>
            Закрыть
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <Card className="max-w-md mx-auto rounded-3xl shadow-xl overflow-hidden border-none">
        <CardHeader className="bg-blue-600 text-white p-8 text-center">
          <CardTitle className="text-2xl">Как всё прошло?</CardTitle>
          <CardDescription className="text-blue-100">
            Поделитесь впечатлениями о визите в {booking.business.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="space-y-4">
            <label className="block text-center font-medium text-slate-700">Ваша оценка</label>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="focus:outline-none transition-transform active:scale-90"
                >
                  <Star
                    className={`w-10 h-10 ${
                      rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block font-medium text-slate-700">Ваш комментарий</label>
            <Textarea
              placeholder="Что вам особенно понравилось?"
              className="min-h-[120px] rounded-xl resize-none"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="block font-medium text-slate-700">Фото (необязательно)</label>
            <div className="grid grid-cols-4 gap-2">
              {photos.map((url, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden group">
                  <img src={url} alt="Review" className="w-full h-full object-cover" />
                  <button 
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Star className="w-3 h-3 fill-current rotate-45" />
                  </button>
                </div>
              ))}
              {photos.length < 4 && (
                <button 
                  onClick={addPhoto}
                  className="aspect-square rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-400 transition-colors"
                >
                  <Camera className="w-6 h-6" />
                  <span className="text-[10px] mt-1">Добавить</span>
                </button>
              )}
            </div>
          </div>

          <Button 
            className="w-full h-14 rounded-2xl text-lg font-bold shadow-lg shadow-blue-100"
            disabled={rating === 0 || submitMutation.isPending}
            onClick={() => submitMutation.mutate({
              bookingId: booking.id,
              rating,
              text,
              photos: photos
            })}
          >
            {submitMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Отправить отзыв'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
