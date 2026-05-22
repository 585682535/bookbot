import React from 'react';
import axios from 'axios';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { Heart, MessageCircle, Share2, MapPin, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';

interface GlobalSocialFeedProps {
  city?: string;
  category?: string;
}

export function GlobalSocialFeed({ city, category }: GlobalSocialFeedProps) {
  const navigate = useNavigate();
  const { ref, inView } = useInView();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading
  } = useInfiniteQuery({
    queryKey: ['global-feed', city, category],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await axios.get('/api/feed', {
        params: { city, category, page: pageParam, limit: 10 }
      });
      return res.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === 10 ? allPages.length + 1 : undefined;
    },
    initialPageParam: 1
  });

  React.useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-[400px] w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  const posts = data?.pages.flat() || [];

  if (posts.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-[32px] border border-slate-100 shadow-sm">
        <div className="text-6xl mb-6">📸</div>
        <h3 className="text-2xl font-black mb-2 tracking-tight">Лента пуста</h3>
        <p className="text-slate-500 max-w-xs mx-auto">
          Здесь появятся публикации заведений из вашего города.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {posts.map((post: any) => (
        <FeedPostCard key={post.id} post={post} />
      ))}

      <div ref={ref} className="h-10 flex items-center justify-center">
        {isFetchingNextPage && <Loader2 className="animate-spin text-blue-600" />}
      </div>
    </div>
  );
}

function FeedPostCard({ post }: { post: any }) {
  const navigate = useNavigate();
  const mediaUrls = JSON.parse(post.mediaUrls || '[]');
  const clientToken = localStorage.getItem('clientToken');

  const handleShare = async () => {
    let shareUrl = `${window.location.origin}/book/${post.business.slug}`;
    
    if (clientToken) {
      try {
        const res = await axios.post('/api/referral/create', { businessId: post.businessId }, {
          headers: { Authorization: `Bearer ${clientToken}` }
        });
        shareUrl = `${window.location.origin}/ref/${res.data.code}`;
      } catch (e) {}
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: post.business.name,
          text: post.text,
          url: shareUrl,
        });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Скопировано');
    }
  };

  return (
    <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div 
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate(`/book/${post.business.slug}`)}
        >
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden border border-slate-50">
            {post.business.logo ? (
              <img src={post.business.logo} className="w-full h-full object-cover" />
            ) : (
               <span className="font-bold text-blue-600">{post.business.name[0]}</span>
            )}
          </div>
          <div>
            <h4 className="font-bold text-sm leading-none mb-1 group-hover:text-blue-600 transition-colors">
               {post.business.name}
            </h4>
            <div className="flex items-center gap-1 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
               <MapPin size={10} />
               {post.business.city} • {post.business.category?.name}
            </div>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="rounded-xl h-8 text-[11px] font-black border-blue-100 text-blue-600 hover:bg-blue-50"
          onClick={() => navigate(`/book/${post.business.slug}`)}
        >
           ЗАПИСАТЬСЯ
        </Button>
      </div>

      {/* Media */}
      <div className="aspect-square bg-slate-50 relative overflow-hidden">
        {post.type === 'VOICE' ? (
          <div className="w-full h-full flex items-center justify-center bg-orange-500">
             <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                <Sparkles className="text-white fill-white" size={32} />
             </div>
          </div>
        ) : (
          <img 
            src={mediaUrls[0]} 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer"
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-4">
              <button className="flex items-center gap-1.5 text-slate-600 hover:text-red-500 transition-colors">
                 <Heart size={20} className={post.isLiked ? 'fill-red-500 text-red-500' : ''} />
                 <span className="text-sm font-bold">{post._count.likes}</span>
              </button>
              <button className="flex items-center gap-1.5 text-slate-600">
                 <MessageCircle size={20} />
                 <span className="text-sm font-bold">{post._count.comments}</span>
              </button>
           </div>
           <button onClick={handleShare} className="text-slate-400 hover:text-blue-600 transition-colors">
              <Share2 size={20} />
           </button>
        </div>

        {post.text && (
          <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">
            <span className="font-bold mr-2">{post.business.name}</span>
            {post.text}
          </p>
        )}

        <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
           {format(new Date(post.createdAt), 'd MMMM HH:mm', { locale: ru })}
        </div>
      </div>
    </div>
  );
}
