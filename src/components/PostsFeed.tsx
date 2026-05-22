import React, { useState, useEffect } from 'react';
import { 
  Card, CardContent 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Heart, Eye, Pin, MessageCircle, MoreVertical, 
  Trash2, Globe, Lock, Plus, ImageIcon, Video, 
  Mic, FileText, Loader2, PinIcon, PinOff
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CreatePostModal } from './CreatePostModal';
import { PostDetailModal } from './PostDetailModal';

interface Post {
  id: string;
  type: string;
  text: string;
  mediaUrls: string;
  voiceUrl: string;
  voiceDuration: number;
  likesCount: number;
  viewsCount: number;
  isPinned: boolean;
  isPublished: boolean;
  createdAt: string;
  _count: {
    likes: number;
    comments: number;
  };
}

export function PostsFeed({ businessSlug, businessId }: { businessSlug: string, businessId: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [business, setBusiness] = useState<any>(null);

  useEffect(() => {
    fetchPosts();
    fetchBusiness();
  }, [businessSlug]);

  const fetchBusiness = async () => {
    try {
      const res = await axios.get(`/api/businesses/${businessSlug}`);
      setBusiness(res.data);
    } catch (e) {}
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/business/${businessSlug}/posts?limit=100`);
      setPosts(res.data);
    } catch (err) {
      toast.error('Не удалось загрузить публикации');
    } finally {
      setLoading(false);
    }
  };

  const togglePin = async (id: string) => {
    try {
      const token = localStorage.getItem('ownerToken');
      await axios.patch(`/api/posts/${id}/pin`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPosts();
      toast.success('Статус закрепления изменен');
    } catch (err) {
      toast.error('Ошибка при закреплении');
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить публикацию?')) return;
    try {
      const token = localStorage.getItem('ownerToken');
      await axios.delete(`/api/posts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosts(posts.filter(p => p.id !== id));
      toast.success('Публикация удалена');
    } catch (err) {
      toast.error('Ошибка при удалении');
    }
  };

  const getMediaPreview = (post: Post) => {
    const media = JSON.parse(post.mediaUrls || '[]');
    if (post.type === 'VOICE') return <Mic className="w-8 h-8 text-orange-500" />;
    if (post.type === 'TEXT') return <FileText className="w-8 h-8 text-blue-500" />;
    if (post.type === 'VIDEO') return <Video className="w-8 h-8 text-purple-500" />;
    if (media.length > 0) return <img src={media[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
    return <ImageIcon className="w-8 h-8 text-slate-300" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Портфолио и публикации</h2>
          <p className="text-slate-500 text-sm">Привлекайте клиентов живым контентом</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Создать пост
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
          <p className="text-slate-500 font-medium tracking-tight">Загружаем ленту...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 p-20 text-center">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center text-3xl mx-auto mb-6">
               📸
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Здесь пока пусто</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-8">
               Опубликуйте свою первую работу, чтобы клиенты могли увидеть ваше мастерство в ленте
            </p>
            <Button onClick={() => setIsModalOpen(true)} variant="outline" className="rounded-2xl px-8 border-2">
               Создать первый пост
            </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {posts.map((post) => (
            <div 
              key={post.id} 
              onClick={() => {
                setSelectedPost(post);
                setIsDetailOpen(true);
              }}
              className="group relative aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 hover:shadow-xl transition-all duration-300 cursor-pointer"
            >
               {/* Media */}
               <div className="w-full h-full flex items-center justify-center bg-slate-50">
                  {getMediaPreview(post)}
               </div>

               {/* Overlay */}
               <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-4">
                  <div className="flex items-center gap-6">
                     <div className="flex flex-col items-center">
                        <Heart className="w-6 h-6 fill-white" />
                        <span className="text-sm font-bold mt-1">{post.likesCount}</span>
                     </div>
                     <div className="flex flex-col items-center">
                        <MessageCircle className="w-6 h-6 fill-white" />
                        <span className="text-sm font-bold mt-1">{post._count.comments}</span>
                     </div>
                     <div className="flex flex-col items-center">
                        <Eye className="w-6 h-6" />
                        <span className="text-sm font-bold mt-1">{post.viewsCount}</span>
                     </div>
                  </div>
                  
                  <div className="flex items-center gap-2 px-4 absolute bottom-4 w-full">
                     <Button 
                        size="icon" 
                        variant="secondary" 
                        className="h-9 w-9 rounded-xl bg-white/20 hover:bg-white/40 text-white border-none backdrop-blur-md"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePin(post.id);
                        }}
                        title={post.isPinned ? "Открепить" : "Закрепить"}
                     >
                        {post.isPinned ? <PinOff size={18} /> : <PinIcon size={18} />}
                     </Button>
                     <Button 
                        size="icon" 
                        variant="destructive" 
                        className="h-9 w-9 rounded-xl shadow-lg ml-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePost(post.id);
                        }}
                     >
                        <Trash2 size={18} />
                     </Button>
                  </div>
               </div>

               {/* Indicators */}
               {post.isPinned && (
                 <div className="absolute top-3 left-3 bg-blue-600 text-white p-1.5 rounded-xl shadow-lg ring-4 ring-white/20">
                    <Pin size={14} className="fill-white" />
                 </div>
               )}
               
               {post.type === 'CAROUSEL' && (
                 <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-1.5 rounded-xl shadow-sm">
                    <ImageIcon size={14} className="text-slate-600" />
                 </div>
               )}
               {post.type === 'VIDEO' && (
                 <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-1.5 rounded-xl shadow-sm">
                    <Video size={14} className="text-slate-600" />
                 </div>
               )}
               {post.type === 'VOICE' && (
                 <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm p-1.5 rounded-xl shadow-sm">
                    <Mic size={14} className="text-slate-600" />
                 </div>
               )}
            </div>
          ))}
        </div>
      )}

      <CreatePostModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchPosts}
        businessId={businessId}
      />

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          business={business}
          onPostUpdate={fetchPosts}
        />
      )}
    </div>
  );
}
