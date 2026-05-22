import React from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, MapPin, Calendar, Star } from 'lucide-react';

export default function InstagramLanding() {
  const { slug } = useParams();
  const navigate = useNavigate();

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

  const { data: staff } = useQuery({
    queryKey: ['staff', slug],
    queryFn: async () => {
      const res = await axios.get(`/api/staff?businessId=${business?.id}`);
      return res.data;
    },
    enabled: !!business?.id,
  });

  const { data: reviews } = useQuery({
    queryKey: ['reviews-public', business?.id],
    queryFn: async () => {
      const res = await axios.get(`/api/reviews?businessId=${business.id}&status=approved`);
      return res.data;
    },
    enabled: !!business?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Skeleton className="h-[500px] w-full max-w-md rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 pb-12">
      <div className="max-w-md mx-auto space-y-6 pt-8">
        <div className="text-center space-y-4">
          <Avatar className="w-24 h-24 mx-auto border-4 border-white shadow-xl">
            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${business?.name}`} />
            <AvatarFallback>{business?.name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{business?.name}</h1>
            <div className="flex items-center justify-center gap-1 text-slate-500 text-sm mt-1">
              <MapPin className="w-3 h-3" />
              {business?.address}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Button 
            size="lg" 
            className="h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-lg font-semibold shadow-lg shadow-blue-100"
            onClick={() => navigate(`/book/${slug}`)}
          >
            <Calendar className="w-5 h-5 mr-2" />
            Записаться онлайн
          </Button>
          
          <Button 
            variant="outline" 
            size="lg" 
            className="h-14 rounded-2xl text-lg font-semibold bg-white"
            onClick={() => window.open(`tel:${business?.phone}`)}
          >
            <Phone className="w-5 h-5 mr-2" />
            Позвонить
          </Button>
        </div>

        <Card className="rounded-3xl border-none shadow-sm bg-white/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Наши услуги</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {services?.filter((s: any) => s.isActive).slice(0, 5).map((service: any) => (
              <div key={service.id} className="flex justify-between items-center py-2 border-b last:border-0 border-slate-100">
                <div className="font-medium text-slate-700">{service.name}</div>
                <div className="font-bold text-blue-600">{service.price} ₽</div>
              </div>
            ))}
            <Button variant="ghost" className="w-full text-blue-600" onClick={() => navigate(`/book/${slug}`)}>
              Смотреть все услуги
            </Button>
          </CardContent>
        </Card>

        {staff?.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 px-2">Наши мастера</h3>
            <div className="flex gap-4 overflow-x-auto pb-4 px-2 no-scrollbar">
              {staff.map((member: any) => (
                <div key={member.id} className="flex-shrink-0 text-center space-y-2">
                  <Avatar className="w-16 h-16 border-2 border-white shadow-md">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`} />
                    <AvatarFallback>{member.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="text-xs font-medium text-slate-600">{member.name.split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {reviews?.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-bold text-slate-900 px-2 flex items-center justify-between">
              Отзывы
              <span className="text-xs font-normal text-slate-500 flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                {(reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length).toFixed(1)}
              </span>
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-4 px-2 no-scrollbar">
              {reviews.map((review: any) => (
                <Card key={review.id} className="flex-shrink-0 w-64 rounded-2xl border-none shadow-sm bg-white p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${review.client.name}`} />
                    </Avatar>
                    <div className="text-xs font-bold">{review.client.name}</div>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-3">{review.text}</p>
                  {review.photos && JSON.parse(review.photos).length > 0 && (
                    <div className="flex gap-1 overflow-hidden">
                      {JSON.parse(review.photos).slice(0, 3).map((url: string, i: number) => (
                        <img key={i} src={url} alt="Review" className="w-12 h-12 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="text-center pt-8">
          <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            Powered by BookBot
          </div>
        </div>
      </div>
    </div>
  );
}
