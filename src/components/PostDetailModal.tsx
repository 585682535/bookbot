import React, { useState, useEffect, useRef } from 'react';
import { 
  Dialog, DialogContent 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Heart, MessageCircle, Eye, Share2, X, 
  Send, Play, Pause, ChevronLeft, ChevronRight,
  Loader2, Tag, Calendar
} from 'lucide-react';
import axios from 'axios';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";

interface PostDetailModalProps {
  post: any;
  isOpen: boolean;
  onClose: () => void;
  business: any;
  onPostUpdate?: () => void;
}

export function PostDetailModal({ post, isOpen, onClose, business, onPostUpdate }: PostDetailModalProps) {
  const [comments, setComments] = useState<any[]>([]);
  const [likes, setLikes] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [currentMediaIdx, setCurrentMediaIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [viewsCount, setViewsCount] = useState(0);
  const [loadingLikes, setLoadingLikes] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaUrls = post?.mediaUrls ? JSON.parse(post.mediaUrls) : [];

  const ownerToken = localStorage.getItem('ownerToken');
  const clientToken = localStorage.getItem('clientToken');
  const isOwner = !!ownerToken;

  useEffect(() => {
    if (isOpen && post) {
      fetchComments();
      incrementViews();
      setLikesCount(post.likesCount);
      setViewsCount(post.viewsCount);
      if (isOwner) fetchLikes();
      
      const likedPosts = JSON.parse(localStorage.getItem('liked_posts') || '[]');
      setIsLiked(likedPosts.includes(post.id));
    } else {
      setShowComments(false);
      setCurrentMediaIdx(0);
      setIsPlaying(false);
      setAudioProgress(0);
    }
  }, [isOpen, post]);

  const incrementViews = async () => {
    try { 
      const token = ownerToken || clientToken;
      const res = await axios.post(`/api/posts/${post.id}/view`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data.viewsCount !== undefined) {
        setViewsCount(res.data.viewsCount);
        if (onPostUpdate) onPostUpdate();
      }
    } catch(e) {}
  };

  const fetchComments = async () => {
    try {
      const res = await axios.get(`/api/posts/${post.id}/comments`);
      setComments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLikes = async () => {
    setLoadingLikes(true);
    try {
      const res = await axios.get(`/api/posts/${post.id}/likes`);
      setLikes(res.data.likes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLikes(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    if (!confirm('Удалить этот комментарий?')) return;
    try {
      await axios.delete(`/api/posts/${post.id}/comments/${commentId}`, {
        headers: { Authorization: `Bearer ${ownerToken}` }
      });
      setComments(comments.filter(c => c.id !== commentId));
      toast.success('Комментарий удален');
    } catch (err) {
      toast.error('Ошибка при удалении');
    }
  };

  const handleLike = async () => {
    try {
      const token = localStorage.getItem('clientToken') || localStorage.getItem('ownerToken');
      const res = await axios.post(`/api/posts/${post.id}/like`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      setIsLiked(res.data.liked);
      setLikesCount(prev => res.data.liked ? prev + 1 : prev - 1);
      
      const likedPosts = JSON.parse(localStorage.getItem('liked_posts') || '[]');
      if (res.data.liked) {
        localStorage.setItem('liked_posts', JSON.stringify([...likedPosts, post.id]));
      } else {
        localStorage.setItem('liked_posts', JSON.stringify(likedPosts.filter((id: string) => id !== post.id)));
      }
      
      if (onPostUpdate) onPostUpdate();
    } catch (err) {
      toast.error('Не удалось поставить лайк');
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;
    const token = localStorage.getItem('clientToken');
    if (!token) {
      toast.error('Войдите как клиент, чтобы оставлять комментарии');
      return;
    }
    
    setIsSubmittingComment(true);
    try {
      const res = await axios.post(`/api/posts/${post.id}/comments`, { text: newComment }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments([...comments, res.data]);
      setNewComment('');
      toast.success('Комментарий отправлен');
    } catch (err) {
      toast.error('Ошибка при отправке комментария');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setAudioProgress(progress);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
  };

  const formatAudioTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!post) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl p-0 overflow-hidden bg-white border-none sm:rounded-3xl shadow-2xl flex flex-col md:flex-row max-h-[90vh] md:h-[600px] lg:h-[700px]">
        <button onClick={onClose} className="absolute top-4 right-4 z-[60] bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors">
           <X size={20} />
        </button>

        {/* Media Section */}
        <div className="w-full md:w-[60%] bg-slate-950 flex items-center justify-center relative aspect-square md:aspect-auto h-full shrink-0">
           {post.type === 'VOICE' ? (

             <div className="w-full h-full flex flex-col items-center justify-center p-12 bg-gradient-to-br from-orange-500 to-red-600">
                <div className="w-32 h-32 rounded-full bg-white/20 backdrop-blur-xl flex items-center justify-center mb-8 border border-white/30 shadow-2xl">
                   <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center text-orange-600">
                      <Play size={40} className={cn("transition-all", isPlaying ? "hidden" : "block ml-2")} onClick={toggleAudio}/>
                      <Pause size={40} className={cn("transition-all", isPlaying ? "block" : "hidden")} onClick={toggleAudio}/>
                   </div>
                </div>
                <audio 
                  ref={audioRef} 
                  src={post.voiceUrl} 
                  onTimeUpdate={handleAudioTimeUpdate}
                  onEnded={handleAudioEnded}
                  className="hidden"
                />
                <div className="w-full max-w-sm space-y-4">
                  <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
                     <div className="h-full bg-white transition-all duration-100" style={{ width: `${audioProgress}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-white text-sm font-mono font-bold">
                     <span>{formatAudioTime(audioRef.current?.currentTime || 0)}</span>
                     <span>{formatAudioTime(post.voiceDuration || 0)}</span>
                  </div>
                  <p className="text-center text-white/90 font-medium text-lg pt-4 tracking-tight">Голосовое сообщение</p>
                </div>
             </div>
           ) : post.type === 'TEXT' ? (
             <div className="w-full h-full bg-slate-50 flex items-center justify-center p-12 overflow-y-auto">
                <p className="text-2xl font-bold text-slate-800 text-center leading-relaxed max-w-md italic">
                   "{post.text}"
                </p>
             </div>
           ) : post.type === 'VIDEO' ? (
             <video 
               src={mediaUrls[0]} 
               controls 
               className="w-full h-full object-contain"
               autoPlay
             />
           ) : (
             <div className="w-full h-full relative group">
                <img 
                  src={mediaUrls[currentMediaIdx]} 
                  className="w-full h-full object-contain" 
                  alt="post"
                  referrerPolicy="no-referrer"
                />
                
                {mediaUrls.length > 1 && (
                  <>
                    <button 
                      onClick={() => setCurrentMediaIdx(idx => idx > 0 ? idx - 1 : idx)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronLeft />
                    </button>
                    <button 
                      onClick={() => setCurrentMediaIdx(idx => idx < mediaUrls.length - 1 ? idx + 1 : idx)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <ChevronRight />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                       {mediaUrls.map((_: any, i: number) => (
                         <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all", i === currentMediaIdx ? "bg-white w-4" : "bg-white/40")} />
                       ))}
                    </div>
                  </>
                )}
             </div>
           )}
        </div>

        {/* Content Section */}
        <div className="w-full md:w-[40%] flex flex-col h-full bg-white">
           <div className="p-4 flex items-center gap-3 border-b border-slate-100">
              <Avatar className="w-10 h-10 border-2 border-primary/10">
                 <AvatarImage src={business?.logo} />
                 <AvatarFallback>{business?.name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                 <h3 className="font-bold text-slate-900 truncate tracking-tight">{business?.name}</h3>
                 <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Calendar size={10} /> {format(new Date(post.createdAt), 'd MMMM yyyy, HH:mm', { locale: ru })}
                 </p>
              </div>
           </div>

           <Tabs defaultValue="info" className="flex-1 flex flex-col min-h-0">
              <div className="px-4 border-b border-slate-50">
                 <TabsList className="w-full bg-transparent h-12 p-0 justify-start gap-4">
                    <TabsTrigger value="info" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-1 h-full text-xs font-bold uppercase tracking-widest text-slate-400">
                       {isOwner ? 'Медиа' : 'Описание'}
                    </TabsTrigger>
                    {isOwner && (
                      <TabsTrigger value="likes" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-1 h-full text-xs font-bold uppercase tracking-widest text-slate-400">
                        Лайки ({likesCount})
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="comments" className="bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-blue-600 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-1 h-full text-xs font-bold uppercase tracking-widest text-slate-400">
                       Комментарии ({comments.length})
                    </TabsTrigger>
                 </TabsList>
              </div>

              <ScrollArea className="flex-1">
                 <TabsContent value="info" className="p-6 m-0 focus-visible:ring-0">
                    <div className="space-y-6">
                       {post.type !== 'TEXT' && post.text && (
                         <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
                            {post.text}
                         </p>
                       )}

                       {post.service && (
                          <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between group">
                             <div>
                                <p className="text-[10px] uppercase font-black text-blue-600 tracking-widest mb-1 italic">С этой публикацией</p>
                                <h4 className="font-black text-sm text-slate-900 group-hover:text-blue-700 transition-colors">{post.service.name}</h4>
                                <p className="text-blue-600 font-black text-xs">{post.service.price} ₽</p>
                             </div>
                             <Button 
                               size="sm" 
                               className="bg-blue-600 hover:bg-blue-700 h-9 rounded-xl shadow-lg shadow-blue-200"
                               onClick={() => window.location.href = `/book/${business.slug}`}
                             >
                                Записаться
                             </Button>
                          </div>
                       )}

                       {isOwner && mediaUrls.length > 0 && (
                         <div className="space-y-3 pt-4 border-t border-slate-50">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Галерея файлов</h4>
                            <div className="grid grid-cols-3 gap-2">
                               {mediaUrls.map((url: string, i: number) => (
                                 <div key={i} className="aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                                    <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                 </div>
                               ))}
                            </div>
                         </div>
                       )}

                       <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                          <div className="flex items-center gap-6">
                             <button onClick={handleLike} className="flex items-center gap-2 group">
                                <Heart className={cn("w-6 h-6 transition-transform group-active:scale-150", isLiked ? "fill-red-500 text-red-500" : "text-slate-400")} />
                                <span className={cn("text-sm font-black", isLiked ? "text-red-500" : "text-slate-500")}>{likesCount}</span>
                             </button>
                          </div>
                          <div className="flex items-center gap-2 text-slate-400">
                             <Eye size={16} />
                             <span className="text-xs font-bold">{viewsCount} просмотров</span>
                          </div>
                       </div>
                    </div>
                 </TabsContent>

                 <TabsContent value="likes" className="p-6 m-0 focus-visible:ring-0">
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Кому понравилось</h4>
                       {loadingLikes ? (
                         <div className="flex justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600 opacity-20" />
                         </div>
                       ) : likes.length === 0 ? (
                         <p className="text-xs text-slate-400 italic py-4">Лайков пока нет</p>
                       ) : (
                         <div className="space-y-3">
                            {likes.map((like: any) => (
                              <div key={like.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50/50 border border-slate-100/50">
                                 <Avatar className="w-8 h-8">
                                    <AvatarFallback className="bg-blue-100 text-blue-600 text-[10px] font-bold">
                                       {like.clientName?.[0]}
                                    </AvatarFallback>
                                 </Avatar>
                                 <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-900 truncate">{like.clientName}</p>
                                    <p className="text-[9px] text-slate-500">{like.clientPhone || 'Анонимный лайк'}</p>
                                 </div>
                                 <p className="text-[9px] text-slate-400 font-medium">
                                    {format(new Date(like.createdAt), 'd MMM', { locale: ru })}
                                 </p>
                              </div>
                            ))}
                         </div>
                       )}
                    </div>
                 </TabsContent>

                 <TabsContent value="comments" className="p-6 m-0 focus-visible:ring-0">
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Диалоги</h4>
                       {comments.length === 0 ? (
                         <p className="text-xs text-slate-400 italic py-4">Нет комментариев. Будьте первыми!</p>
                       ) : (
                         <div className="space-y-4">
                            {comments.map((comment: any) => (
                              <div key={comment.id} className="flex gap-3 relative group/comment">
                                 <Avatar className="w-8 h-8 flex-shrink-0">
                                    <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-bold">
                                      {comment.client?.name?.[0]}
                                    </AvatarFallback>
                                 </Avatar>
                                 <div className="flex-1">
                                    <div className="bg-slate-50 rounded-2xl p-3">
                                       <div className="flex items-center justify-between mb-1">
                                          <div className="flex flex-col">
                                             <p className="text-[10px] font-black">{comment.client?.name || 'Клиент'}</p>
                                             {isOwner && comment.client?.phone && (
                                               <p className="text-[8px] text-blue-600 font-bold">{comment.client.phone}</p>
                                             )}
                                          </div>
                                          <p className="text-[9px] text-slate-400">{format(new Date(comment.createdAt), 'HH:mm, d MMM', { locale: ru })}</p>
                                       </div>
                                       <p className="text-xs text-slate-700 leading-relaxed">{comment.text}</p>
                                    </div>
                                    
                                    {isOwner && (
                                      <div className="flex items-center gap-4 mt-1 px-2">
                                         <button 
                                           onClick={() => deleteComment(comment.id)}
                                           className="text-[9px] font-bold text-red-500 hover:text-red-700 opacity-0 group-hover/comment:opacity-100 transition-opacity"
                                         >
                                            Удалить
                                         </button>
                                         <button className="text-[9px] font-bold text-slate-400 hover:text-blue-600 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                                            Ответить
                                         </button>
                                      </div>
                                    )}
                                 </div>
                              </div>
                            ))}
                         </div>
                       )}
                    </div>
                 </TabsContent>
              </ScrollArea>
           </Tabs>

           <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <div className="flex gap-2">
                 <Input 
                   placeholder="Напишите комментарий..." 
                   className="rounded-2xl bg-white border-slate-100 text-sm h-11 focus:ring-blue-500"
                   value={newComment}
                   onChange={e => setNewComment(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleSubmitComment()}
                 />
                 <Button 
                   size="icon" 
                   disabled={isSubmittingComment || !newComment.trim()} 
                   onClick={handleSubmitComment}
                   className="h-11 w-11 rounded-2xl bg-blue-600 hover:bg-blue-700"
                 >
                    {isSubmittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={18} />}
                 </Button>
              </div>
              <p className="text-[9px] text-slate-400 text-center mt-2 font-medium">Только зарегистрированные клиенты могут комментировать</p>
           </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
