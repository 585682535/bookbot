import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, X, Bot, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Chatbot() {
  const { slug } = useParams();
  const [isOpen, setIsOpen] = useState(false);
  const [business, setBusiness] = useState<any>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    { role: 'model', text: 'Привет! Я AI Администратор. Чем могу помочь с вашей записью?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (slug) {
      axios.get(`/api/businesses/${slug}`)
        .then(res => setBusiness(res.data))
        .catch(err => console.error("Error fetching business for chatbot:", err));
    }
  }, [slug]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isLoading, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !business) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const res = await axios.post('/api/chat', {
        businessId: business.id,
        message: userMessage,
        history: messages
      });

      if (res.data.text) {
        setMessages(prev => [...prev, { role: 'model', text: res.data.text }]);
      } else {
        throw new Error("Empty response from AI");
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMsg = error.response?.data?.error || "Извините, произошла техническая ошибка. Попробуйте позже.";
      setMessages(prev => [...prev, { role: 'model', text: errorMsg }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-4 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full sm:w-96 h-[75vh] sm:h-[550px] flex flex-col mb-4 overflow-hidden"
          >
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                  <Bot size={18} className="text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm leading-none">{business?.name}</h3>
                  <p className="text-[10px] text-slate-400 mt-1">Онлайн-ассистент</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white h-8 w-8 hover:bg-white/10 rounded-full">
                <X size={18} />
              </Button>
            </div>

            <ScrollArea className="flex-1 px-4 py-6">
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                    }`}>
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none border border-slate-200">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex gap-2 shrink-0">
              <Input 
                placeholder="Записаться на сегодня..." 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="rounded-full bg-white border-slate-200 h-11 text-sm pl-4 focus-visible:ring-blue-500"
              />
              <Button 
                size="icon" 
                onClick={handleSend} 
                disabled={isLoading} 
                className="rounded-full bg-blue-600 hover:bg-blue-700 h-11 w-11 shadow-md shadow-blue-200 flex-shrink-0"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)} 
        className={`w-14 h-14 rounded-full shadow-xl shadow-blue-200 flex items-center justify-center transition-all duration-300 z-50 ${
          isOpen ? 'bg-slate-900' : 'bg-blue-600'
        }`}
      >
        {isOpen ? <X className="text-white" size={24} /> : <MessageCircle className="text-white" size={24} />}
      </motion.button>
    </div>
  );
}

