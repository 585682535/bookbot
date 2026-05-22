import { X, Star, MapPin, Phone, Clock, ChevronRight, Grid, Heart, MessageCircle, Play, Share2, ThumbsUp, UserCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import React from 'react';
import axios from 'axios';
import { toast } from 'sonner';

interface BusinessDrawerProps {
  business: any;
  onClose: () => void;
  onBook: () => void;
}

export function BusinessDrawer({ business, onClose, onBook }: BusinessDrawerProps) {
  const navigate = useNavigate();
  const [isFollowing, setIsFollowing] = React.useState(false);
  const [isRecommended, setIsRecommended] = React.useState(false);
  const [followInfo, setFollowInfo] = React.useState<any>(null);
  const [recommendations, setRecommendations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  const clientToken = localStorage.getItem('clientToken');
  const isClient = !!clientToken;

  React.useEffect(() => {
    const fetchSocialData = async () => {
      try {
        const [followRes, recommendRes] = await Promise.all([
          axios.get(`/api/business/${business.id}/followers`),
          axios.get(`/api/business/${business.id}/recommendations`)
        ]);
        setFollowInfo(followRes.data);
        setRecommendations(recommendRes.data);

        if (isClient) {
          const [followingRes, recommendedRes] = await Promise.all([
            axios.get('/api/following', {
              headers: { Authorization: `Bearer ${clientToken}` }
            }),
            axios.get(`/api/business/${business.id}/recommendations`)
          ]);
          setIsFollowing(followingRes.data.some((b: any) => b.id === business.id));
          const getClientId = (token: string) => {
            try {
              const payload = token.split('.')[1];
              if (!payload) return null;
              return JSON.parse(atob(payload)).id;
            } catch (e) {
              return null;
            }
          };
          const clientId = getClientId(clientToken);
          setIsRecommended(recommendedRes.data.some((r: any) => r.clientId === clientId));
        }
      } catch (e) {
        console.error('Error fetching social data:', e);
      }
    };
    fetchSocialData();
  }, [business.id, isClient, clientToken]);

  const toggleFollow = async () => {
    console.log('[BusinessDrawer] toggleFollow clicked', { isClient, isFollowing });
    if (!isClient) return toast.error('Пожалуйста, войдите как клиент');
    setLoading(true);
    try {
      if (isFollowing) {
        await axios.delete(`/api/follow/${business.id}`, {
          headers: { Authorization: `Bearer ${clientToken}` }
        });
        setIsFollowing(false);
        setFollowInfo((prev: any) => ({ ...prev, count: Math.max(0, (prev?.count || 0) - 1) }));
      } else {
        await axios.post('/api/follow', { businessId: business.id }, {
          headers: { Authorization: `Bearer ${clientToken}` }
        });
        setIsFollowing(true);
        setFollowInfo((prev: any) => ({ ...prev, count: (prev?.count || 0) + 1 }));
      }
    } catch (e) {
      console.error('[BusinessDrawer] follow error', e);
      toast.error('Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const toggleRecommend = async () => {
    console.log('[BusinessDrawer] toggleRecommend clicked', { isClient, isRecommended });
    if (!isClient) return toast.error('Пожалуйста, войдите как клиент');
    setLoading(true);
    try {
      if (isRecommended) {
        await axios.delete(`/api/recommend/${business.id}`, {
          headers: { Authorization: `Bearer ${clientToken}` }
        });
        setIsRecommended(false);
      } else {
        await axios.post('/api/recommend', { businessId: business.id }, {
          headers: { Authorization: `Bearer ${clientToken}` }
        });
        setIsRecommended(true);
      }
      // Re-fetch recommendations to refresh list
      const res = await axios.get(`/api/business/${business.id}/recommendations`);
      setRecommendations(res.data);
    } catch (e) {
      console.error('[BusinessDrawer] recommend error', e);
      toast.error('Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    let shareUrl = `${window.location.origin}/book/${business.slug}`;
    
    if (isClient) {
      try {
        const res = await axios.post('/api/referral/create', { businessId: business.id }, {
          headers: { Authorization: `Bearer ${clientToken}` }
        });
        shareUrl = `${window.location.origin}/ref/${res.data.code}`;
      } catch (e) {
        console.error('Error creating referral link:', e);
      }
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Забронируй в ${business.name}`,
          text: business.description || 'Рекомендую это место!',
          url: shareUrl,
        });
      } catch (e) {
        console.error('Share error:', e);
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Ссылка скопирована в буфер обмена');
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Хедер drawer */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-bold text-lg truncate pr-4">{business.name}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-slate-500"
            title="Поделиться"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
      
        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 relative">
          
          {/* Обложка */}
          {business.coverImage ? (
            <img
              src={business.coverImage}
              alt={business.name}
              referrerPolicy="no-referrer"
              className="w-full h-48 object-cover rounded-2xl"
            />
          ) : (
            <div className="w-full h-32 bg-slate-50 flex items-center justify-center rounded-2xl text-4xl">
               {business.category?.icon || '🏪'}
            </div>
          )}

          {/* Social Actions */}
          <div className="flex gap-2 relative z-50 pointer-events-auto bg-white/50 backdrop-blur-md p-1 rounded-2xl border border-slate-50 shadow-sm sticky top-0">
            <Button
              variant={isFollowing ? "outline" : "default"}
              size="sm"
              className={cn(
                "flex-1 rounded-xl h-10 font-bold relative z-50 cursor-pointer pointer-events-auto",
                isFollowing && "border-blue-200 text-blue-600 bg-blue-50"
              )}
              onClick={() => {
                console.log('[BusinessDrawer] Follow click detected');
                toggleFollow();
              }}
              disabled={loading}
            >
              {isFollowing ? <UserCheck className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              {isFollowing ? 'Подписан' : 'Подписаться'}
            </Button>

            <Button
              variant={isRecommended ? "default" : "outline"}
              size="sm"
              className={cn(
                "flex-1 rounded-xl h-10 font-bold relative z-50 cursor-pointer pointer-events-auto",
                isRecommended ? "bg-pink-600 hover:bg-pink-700" : "border-slate-200"
              )}
              onClick={() => {
                console.log('[BusinessDrawer] Recommend click detected');
                toggleRecommend();
              }}
              disabled={loading}
            >
              <ThumbsUp className={cn("w-4 h-4 mr-2", isRecommended && "fill-white")} />
              {isRecommended ? 'Рекомендую' : 'Рекомендовать'}
            </Button>
          </div>
        
        {/* Рейтинг и статус */}
        <div className="flex items-center flex-wrap gap-2">
          {business.avgRating && (
            <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-bold text-sm">{business.avgRating}</span>
              <span className="text-gray-400 text-xs ml-1">
                ({business.reviewCount} отзывов)
              </span>
            </div>
          )}

          {followInfo?.count > 0 && (
            <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg text-blue-700 text-xs font-bold">
              <UserCheck className="w-3 h-3" />
              {followInfo.count} подписчиков
            </div>
          )}
          
          <Badge className={business.isOpenNow ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"} variant="outline">
            {business.isOpenNow ? "Открыто" : "Закрыто"}
          </Badge>
          
          {business.isFeatured && (
            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">⭐ Топ</Badge>
          )}
        </div>

        {/* Recommendations list */}
        {recommendations.length > 0 && (
          <div className="bg-slate-50 rounded-2xl p-3 flex items-center gap-3">
             <div className="flex -space-x-2">
               {recommendations.slice(0, 3).map((rec, i) => (
                 <div key={i} className="w-8 h-8 rounded-full bg-blue-100 border-2 border-slate-50 flex items-center justify-center text-[10px] font-bold text-blue-600">
                    {rec.client.name?.charAt(0) || 'U'}
                 </div>
               ))}
               {recommendations.length > 3 && (
                 <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    +{recommendations.length - 3}
                 </div>
               )}
             </div>
             <p className="text-xs text-slate-500 font-medium">
               Рекомендуют: {recommendations.slice(0, 2).map(r => r.client.name).join(', ')}
               {recommendations.length > 2 && ' и другие'}
             </p>
          </div>
        )}
        
        {/* Описание */}
        {business.description && (
          <div>
            <p className="text-slate-600 text-sm leading-relaxed">{business.description}</p>
          </div>
        )}

        {/* Свежие публикации */}
        {business.posts && business.posts.length > 0 && (
          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                   <Grid size={18} className="text-blue-600" />
                   Свежее в ленте
                </h3>
                <button 
                  onClick={() => navigate(`/b/${business.slug}/feed`)}
                  className="text-xs font-black text-blue-600 hover:underline flex items-center gap-1"
                >
                   Смотреть все <ChevronRight size={14} />
                </button>
             </div>
             
             <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
                {business.posts.map((post: any) => {
                  const media = JSON.parse(post.mediaUrls || '[]');
                  return (
                    <div 
                      key={post.id}
                      onClick={() => navigate(`/b/${business.slug}/feed`)}
                      className="min-w-[160px] aspect-square rounded-2xl bg-slate-100 relative overflow-hidden snap-start cursor-pointer border border-slate-100 shadow-sm"
                    >
                       {post.type === 'VOICE' ? (
                         <div className="w-full h-full flex items-center justify-center bg-orange-500 text-white">
                            <Play fill="currentColor" size={24} />
                         </div>
                       ) : post.type === 'TEXT' ? (
                         <div className="w-full h-full flex items-center justify-center p-4 bg-slate-50">
                            <p className="text-[10px] font-bold text-slate-400 text-center line-clamp-4">{post.text}</p>
                         </div>
                       ) : (
                         <img src={media[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                       )}
                       
                       <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-full px-2 py-1 text-[10px] text-white font-black">
                          <Heart size={10} className="fill-white" />
                          {post.likesCount}
                       </div>
                    </div>
                  );
                })}
             </div>
          </div>
        )}

        <Separator />

        {/* Инфо */}
        <div className="space-y-3">
            {/* Адрес */}
            {business.address && (
              <div className="flex items-start gap-3 text-slate-700">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">{business.address}</p>
                  {business.distance !== null && (
                    <p className="text-xs text-slate-400">{business.distance} км от вас</p>
                  )}
                </div>
              </div>
            )}
            
            {/* Телефон */}
            {business.phone && (
              <a
                href={`tel:${business.phone}`}
                className="flex items-center gap-3 text-slate-700 hover:text-blue-600 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm font-medium">{business.phone}</span>
              </a>
            )}

            {/* Часы работы (кратко) */}
            <div className="flex items-center gap-3 text-slate-700">
                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-orange-600" />
                </div>
                <span className="text-sm font-medium">Работаем до вечера</span>
            </div>
        </div>
        
        <Separator />
        
        {/* Услуги */}
        <div>
          <h3 className="font-bold mb-4 flex items-center justify-between">
              Популярные услуги
              <span className="text-xs font-normal text-slate-400">{(business.services || []).length} всего</span>
          </h3>
          <div className="space-y-3">
            {(business.services || []).map((service: any) => (
              <div
                key={service.id}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-50 bg-slate-50/50"
              >
                <div>
                  <p className="font-bold text-sm tracking-tight">{service.name}</p>
                  <p className="text-xs text-slate-500">
                    {service.durationMinutes} мин
                  </p>
                </div>
                <p className="font-bold text-blue-600">
                  {service.price} ₽
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Кнопка записи */}
      <div className="p-4 border-t sticky bottom-0 bg-white shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        <Button className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 font-bold text-lg shadow-lg shadow-blue-200" onClick={onBook}>
          Записаться онлайн
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
