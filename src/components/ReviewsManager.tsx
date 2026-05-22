import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Check, X, MessageSquare, User } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function ReviewsManager() {
  const { slug } = useParams();
  const queryClient = useQueryClient();

  const { data: business } = useQuery({
    queryKey: ['business', slug],
    queryFn: async () => {
      const res = await axios.get(`/api/businesses/${slug}`);
      return res.data;
    },
  });

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['reviews', business?.id],
    queryFn: async () => {
      const res = await axios.get(`/api/reviews?businessId=${business.id}`);
      return res.data;
    },
    enabled: !!business?.id,
  });

  const moderateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      await axios.patch(`/api/reviews/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', business?.id] });
      toast.success('Статус отзыва обновлен');
    },
  });

  if (isLoading) return <div className="p-8 text-center">Загрузка...</div>;

  const pending = reviews?.filter((r: any) => r.status === 'pending') || [];
  const approved = reviews?.filter((r: any) => r.status === 'approved') || [];
  const rejected = reviews?.filter((r: any) => r.status === 'rejected') || [];

  const ReviewCard = ({ review }: { review: any }) => (
    <Card key={review.id} className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4">
            <Avatar className="w-10 h-10">
              <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${review.client?.name || '?'}`} />
              <AvatarFallback>{review.client?.name?.[0] || '?'}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold">{review.client?.name || 'Аноним'}</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`w-3 h-3 ${review.rating >= s ? 'fill-yellow-400 text-yellow-400' : 'text-slate-200'}`} />
                  ))}
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{review.text}</p>
              
              {review.photos && JSON.parse(review.photos).length > 0 && (
                <div className="flex gap-2 mt-3">
                  {JSON.parse(review.photos).map((url: string, i: number) => (
                    <img 
                      key={i} 
                      src={url} 
                      alt="Review" 
                      className="w-16 h-16 rounded-lg object-cover border border-slate-100" 
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 text-[10px] text-slate-400 uppercase tracking-wider font-bold pt-2">
                <span className="flex items-center gap-1"><User className="w-3 h-3" /> {review.staff?.name || 'Любой мастер'}</span>
                <span>{format(new Date(review.createdAt), 'dd.MM.yyyy HH:mm')}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            {review.status === 'pending' && (
              <>
                <Button 
                  size="sm" 
                  className="bg-green-600 hover:bg-green-700 h-8"
                  onClick={() => moderateMutation.mutate({ id: review.id, status: 'approved' })}
                >
                  <Check className="w-4 h-4 mr-1" /> Одобрить
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-red-600 hover:text-red-700 h-8"
                  onClick={() => moderateMutation.mutate({ id: review.id, status: 'rejected' })}
                >
                  <X className="w-4 h-4 mr-1" /> Отклонить
                </Button>
              </>
            )}
            {review.status === 'approved' && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-slate-400 h-8"
                onClick={() => moderateMutation.mutate({ id: review.id, status: 'rejected' })}
              >
                Скрыть
              </Button>
            )}
            {review.status === 'rejected' && (
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-slate-400 h-8"
                onClick={() => moderateMutation.mutate({ id: review.id, status: 'approved' })}
              >
                Восстановить
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Отзывы</h2>
        <p className="text-sm text-slate-500">Модерируйте отзывы клиентов и отвечайте на них</p>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="pending" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Ожидают ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Опубликованы ({approved.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Отклонены ({rejected.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pending.map((r: any) => <ReviewCard key={r.id} review={r} />)}
          {pending.length === 0 && <div className="text-center py-20 text-slate-400">Нет отзывов на модерации</div>}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {approved.map((r: any) => <ReviewCard key={r.id} review={r} />)}
          {approved.length === 0 && <div className="text-center py-20 text-slate-400">Нет опубликованных отзывов</div>}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {rejected.map((r: any) => <ReviewCard key={r.id} review={r} />)}
          {rejected.length === 0 && <div className="text-center py-20 text-slate-400">Нет отклоненных отзывов</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
