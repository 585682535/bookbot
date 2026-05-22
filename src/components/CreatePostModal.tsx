import React, { useState, useRef, useEffect } from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Image as ImageIcon, Video, FileText, Mic, X, 
  Plus, Check, Loader2, Play, Square, Trash2, Tag
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  businessId: string;
}

type PostType = 'IMAGE' | 'VIDEO' | 'TEXT' | 'VOICE' | 'CAROUSEL';

export function CreatePostModal({ isOpen, onClose, onSuccess, businessId }: CreatePostModalProps) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState<PostType | null>(null);
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);

  // Debug log for step changes
  useEffect(() => {
    console.log('[CreatePostModal] Step:', step, 'Type:', type);
  }, [step, type]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      fetchServices();
    } else {
      resetForm();
    }
  }, [isOpen]);

  const fetchServices = async () => {
    try {
      const res = await axios.get(`/api/services?businessId=${businessId}`);
      setServices(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      setServices([]);
    }
  };

  const resetForm = () => {
    setStep(1);
    setType(null);
    setText('');
    setFiles([]);
    setPreviews([]);
    setIsRecording(false);
    setRecordingTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setSelectedServiceId(null);
    setTags([]);
    setIsPublic(true);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const limit = type === 'VIDEO' ? 1 : 10;
      const combined = [...files, ...newFiles].slice(0, limit);
      setFiles(combined);
      
      const newPreviews = combined.map(file => URL.createObjectURL(file));
      setPreviews(newPreviews);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    
    const newPreviews = [...previews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setPreviews(newPreviews);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setFiles([new File([blob], 'recording.webm', { type: 'audio/webm' })]);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error('Доступ к микрофону запрещен');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleSubmit = async () => {
    if (!type) return;
    setIsSubmitting(true);
    
    const formData = new FormData();
    formData.append('type', type === 'IMAGE' && files.length > 1 ? 'CAROUSEL' : type);
    formData.append('text', text);
    formData.append('tags', JSON.stringify(tags));
    if (selectedServiceId) formData.append('serviceId', selectedServiceId);
    if (type === 'VOICE') formData.append('voiceDuration', recordingTime.toString());
    formData.append('isPublic', isPublic.toString());
    
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const token = localStorage.getItem('ownerToken');
      await axios.post('/api/posts', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      toast.success('Публикация создана!');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка при создании публикации');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] sm:h-[80vh] flex flex-col p-0 overflow-hidden bg-white border-slate-200 shadow-2xl rounded-3xl">
        <DialogHeader className="p-6 pb-4 border-b border-slate-50 shrink-0">
          <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">Новая публикация</DialogTitle>
          <DialogDescription className="text-slate-500 text-sm">
            {step === 1 ? 'Выберите тип контента' : 'Заполните детали публикации'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="p-6">
            {step === 1 ? (
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-32 flex flex-col gap-2 border-2 hover:border-blue-500 hover:bg-blue-50"
                onClick={() => { setType('IMAGE'); setStep(2); }}
              >
                <ImageIcon className="w-8 h-8 text-blue-500" />
                <span>Фото</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-32 flex flex-col gap-2 border-2 hover:border-purple-500 hover:bg-purple-50"
                onClick={() => { setType('VIDEO'); setStep(2); }}
              >
                <Video className="w-8 h-8 text-purple-500" />
                <span>Видео</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-32 flex flex-col gap-2 border-2 hover:border-green-500 hover:bg-green-50"
                onClick={() => { setType('TEXT'); setStep(2); }}
              >
                <FileText className="w-8 h-8 text-green-500" />
                <span>Текст</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-32 flex flex-col gap-2 border-2 hover:border-orange-500 hover:bg-orange-50"
                onClick={() => { setType('VOICE'); setStep(2); }}
              >
                <Mic className="w-8 h-8 text-orange-500" />
                <span>Голосовое</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Media Selection */}
              {(type === 'IMAGE' || type === 'VIDEO') && (
                <div className="space-y-4">
                  <Label>{type === 'IMAGE' ? 'Изображения (до 10)' : 'Видео'}</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {previews.map((src, idx) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                        {type === 'IMAGE' ? (
                          <img src={src} className="w-full h-full object-cover" alt="preview" referrerPolicy="no-referrer" />
                        ) : (
                          <video src={src} className="w-full h-full object-cover" />
                        )}
                        <button 
                          onClick={() => removeFile(idx)}
                          className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {(type === 'IMAGE' ? files.length < 10 : files.length < 1) && (
                      <label className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors">
                        <Plus className="w-6 h-6 text-slate-400" />
                        <input 
                          type="file" 
                          className="hidden" 
                          accept={type === 'IMAGE' ? "image/*" : "video/*"} 
                          multiple={type === 'IMAGE'}
                          onChange={handleFileChange}
                        />
                      </label>
                    )}
                  </div>
                </div>
              )}

              {type === 'VOICE' && (
                <div className="space-y-4">
                  <Label>Голосовое сообщение</Label>
                  <div className="flex items-center gap-4 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    {!audioBlob ? (
                      <Button 
                        onClick={isRecording ? stopRecording : startRecording}
                        variant={isRecording ? "destructive" : "default"}
                        className="w-16 h-16 rounded-full p-0 flex items-center justify-center animate-in zoom-in"
                      >
                        {isRecording ? <Square size={24} /> : <Mic size={24} />}
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                         <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                            <Play size={20} fill="currentColor" />
                         </div>
                         <div className="flex-1">
                            <p className="text-sm font-bold">Запись готова</p>
                            <p className="text-xs text-slate-500">{formatTime(recordingTime)}</p>
                         </div>
                         <Button variant="ghost" size="icon" onClick={() => { setAudioBlob(null); setAudioUrl(null); setFiles([]); setRecordingTime(0); }}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                         </Button>
                      </div>
                    )}
                    {isRecording && (
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-red-500 animate-pulse">Запись...</span>
                          <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
                        </div>
                        <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                           <div className="h-full bg-red-500 w-full animate-progress-indefinite" />
                        </div>
                      </div>
                    )}
                    {!isRecording && !audioBlob && (
                      <p className="text-sm text-slate-500">Нажмите кнопку, чтобы начать запись</p>
                    )}
                  </div>
                </div>
              )}

              {/* Text / Caption */}
              <div className="space-y-4">
                <Label>{type === 'TEXT' ? 'Текст публикации' : 'Подпись'}</Label>
                <Textarea 
                  placeholder={type === 'TEXT' ? "О чем вы хотите рассказать?" : "Добавьте описание..."}
                  className={cn("min-h-[120px] resize-none", type === 'TEXT' ? 'text-lg' : '')}
                  value={text}
                  onChange={e => setText(e.target.value)}
                />
              </div>

              {/* Service Tagging */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                   <Tag className="w-4 h-4" /> Привязать услугу
                </Label>
                <div className="flex flex-wrap gap-2">
                   {services.map(service => (
                     <button
                       key={service.id}
                       onClick={() => setSelectedServiceId(selectedServiceId === service.id ? null : service.id)}
                       className={cn(
                         "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                         selectedServiceId === service.id 
                           ? "bg-blue-600 border-blue-600 text-white shadow-md scale-105" 
                           : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                       )}
                     >
                       {service.name}
                     </button>
                   ))}
                </div>
              </div>

              {/* Visibility Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="space-y-0.5">
                  <Label className="text-base tracking-tight font-bold">Публично в общей ленте</Label>
                  <p className="text-xs text-slate-500">Показывать этот пост всем пользователям маркетплейса</p>
                </div>
                <Switch 
                  checked={isPublic} 
                  onCheckedChange={setIsPublic} 
                />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

        <DialogFooter className="p-6 border-t border-slate-100 flex flex-row items-center justify-end gap-2 shrink-0">
          {step === 2 && (
            <Button variant="ghost" onClick={() => setStep(1)} disabled={isSubmitting} className="rounded-xl">
              Назад
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="rounded-xl">
            Отмена
          </Button>
          {step === 2 && (
            <Button 
              onClick={() => {
                console.log('[CreatePostModal] Publishing click detected');
                handleSubmit();
              }} 
              disabled={isSubmitting || (type === 'IMAGE' && files.length === 0) || (type === 'VIDEO' && files.length === 0) || (type === 'VOICE' && !audioBlob) || (type === 'TEXT' && !text.trim())}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[140px] rounded-xl shadow-lg shadow-blue-200 relative z-50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Опубликовать
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
