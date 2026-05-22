import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Heart, Eye, MessageCircle, Star, 
  MapPin, Clock, Calendar, ChevronRight,
  TrendingUp, Image as ImageIcon, Video, 
  Mic, FileText, Loader2, ArrowLeft, Grid
} from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';
import { PostDetailModal } from '@/components/PostDetailModal';

export default function BusinessFeedPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [business, setBusiness] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [slug]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [busRes, postsRes] = await Promise.all([
        axios.get(`/api/businesses/${slug}`),
        axios.get(`/api/business/${slug}/posts`)
      ]);
      setBusiness(busRes.data);
      setPosts(postsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getMediaPreview = (post: any) => {
    const media = JSON.parse(post.mediaUrls || '[]');
    if (post.type === 'VOICE') {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-400 to-red-500">
           <Mic className="w-10 h-10 text-white" />
        </div>
      );
    }
    if (post.type === 'TEXT') {
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-50 p-4">
           <p className="text-xs font-bold text-slate-400 line-clamp-3 text-center">{post.text}</p>
        </div>
      );
    }
    if (post.type === 'VIDEO') {
      return (
        <div className="w-full h-full relative">
           <video src={media[0]} className="w-full h-full object-cover" />
           <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Video className="w-8 h-8 text-white" />
           </div>
        </div>
      );
    }
    if (media.length > 0) {
      return <img src={media[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
    }
    return <FileText className="w-8 h-8 text-slate-200" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!business) return null;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
                 <ArrowLeft size={20} />
              </Button>
              <div className="flex items-center gap-3">
                 <Avatar className="w-10 h-10 border-2 border-primary/10">
                    <AvatarImage src={business.logo} />
                    <AvatarFallback>{business.name[0]}</AvatarFallback>
                 </Avatar>
                 <div>
                    <h1 className="font-black text-sm text-slate-900 truncate max-w-[150px] sm:max-w-none">{business.name}</h1>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{business.category?.name || 'Услуги'}</p>
                 </div>
              </div>
           </div>
           
           <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 rounded-full border border-yellow-100 shadow-sm">
                 <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                 <span className="text-xs font-black text-yellow-700">{business.rating || 5.0}</span>
              </div>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-6 font-black shadow-lg shadow-blue-200"
                onClick={() => navigate(`/book/${slug}`)}
              >
                 Записаться
              </Button>
           </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
        <Tabs defaultValue="feed" className="w-full">
          <TabsList className="bg-white p-1 rounded-2xl border border-slate-100 shadow-sm h-14 mb-8 w-full sm:w-auto">
            <TabsTrigger value="feed" className="rounded-xl px-8 data-[state=active]:bg-slate-900 data-[state=active]:text-white h-full flex items-center gap-2">
               <Grid size={16} /> Лента
            </TabsTrigger>
            <TabsTrigger value="services" className="rounded-xl px-8 h-full">Услуги</TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-xl px-8 h-full">Отзывы</TabsTrigger>
          </TabsList>

          <TabsContent value="feed">
             {posts.length === 0 ? (
               <div className="text-center py-24 px-12 bg-white rounded-[40px] border border-slate-100 shadow-sm">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6">🏜️</div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">Лента пока пуста</h2>
                  <p className="text-slate-500">Заходите позже, чтобы увидеть новые публикации бизнеса</p>
               </div>
             ) : (
               <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {posts.map((post) => (
                    <div 
                      key={post.id} 
                      className="group relative aspect-square bg-slate-100 rounded-3xl overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-500"
                      onClick={() => { setSelectedPost(post); setIsPostModalOpen(true); }}
                    >
                       {getMediaPreview(post)}

                       {/* Hover Info */}
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-black">
                          <div className="flex items-center gap-2">
                             <Heart size={20} className="fill-white" />
                             <span>{post.likesCount}</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <MessageCircle size={20} className="fill-white" />
                             <span>{post._count?.comments || 0}</span>
                          </div>
                       </div>

                       {/* Indicators */}
                       {post.isPinned && (
                         <div className="absolute top-3 left-3 bg-blue-600 text-white p-1.5 rounded-xl shadow-lg ring-4 ring-white/20">
                            <TrendingUp size={14} className="fill-white" />
                         </div>
                       )}
                       
                       {post.type === 'CAROUSEL' && (
                         <div className="absolute top-3 right-3 bg-white/30 backdrop-blur-md p-1.5 rounded-xl text-white">
                            <ImageIcon size={14} />
                         </div>
                       )}
                    </div>
                  ))}
               </div>
             )}
          </TabsContent>

          <TabsContent value="services" className="bg-white rounded-[40px] p-8 border border-slate-100">
             <div className="flex flex-col items-center justify-center py-20 grayscale opacity-40">
                <FileText size={48} className="mb-4" />
                <p className="font-black text-slate-400">Услуги доступны на главной странице бизнеса</p>
                <Button variant="link" onClick={() => navigate(`/book/${slug}`)} className="text-blue-600 mt-2 font-black">Перейти к записи</Button>
             </div>
          </TabsContent>

          <TabsContent value="reviews" className="bg-white rounded-[40px] p-8 border border-slate-100">
             <div className="flex flex-col items-center justify-center py-20 grayscale opacity-40">
                <Star size={48} className="mb-4" />
                <p className="font-black text-slate-400">Отзывы доступны на главной странице бизнеса</p>
                <Button variant="link" onClick={() => navigate(`/book/${slug}`)} className="text-blue-600 mt-2 font-black">Смотреть отзывы</Button>
             </div>
          </TabsContent>
        </Tabs>
      </div>

      <PostDetailModal 
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        post={selectedPost}
        business={business}
        onPostUpdate={fetchData}
      />
      
      {/* Sticky Bottom Booking for Mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-100 flex items-center justify-between sm:hidden z-50">
         <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Средний чек</p>
            <p className="text-lg font-black text-slate-900 leading-none">от 500 ₽</p>
         </div>
         <Button 
           size="lg"
           className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-12 font-black shadow-xl shadow-blue-200"
           onClick={() => navigate(`/book/${slug}`)}
         >
            Записаться
         </Button>
      </div>
    </div>
  );
}
