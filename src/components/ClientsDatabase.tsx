import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Search, User, Phone, Mail, Calendar, TrendingUp, History, CheckCircle, XCircle, Plus, StickyNote, Send, Gift, Clock } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ClientsDatabase() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients', slug, search],
    queryFn: async () => {
      const res = await axios.get(`/api/clients?search=${search}`);
      return res.data;
    },
  });

  const { data: clientDetails, isLoading: isDetailsLoading } = useQuery({
    queryKey: ['client', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return null;
      const res = await axios.get(`/api/clients/${selectedClientId}`);
      return res.data;
    },
    enabled: !!selectedClientId,
  });

  const { data: notes } = useQuery({
    queryKey: ['client-notes', selectedClientId],
    queryFn: async () => {
      if (!selectedClientId) return [];
      const res = await axios.get(`/api/clients/${selectedClientId}/notes`);
      return res.data;
    },
    enabled: !!selectedClientId,
  });

  const addNoteMutation = useMutation({
    mutationFn: async (text: string) => {
      await axios.post('/api/client-notes', {
        clientId: selectedClientId,
        businessId: clientDetails.businessId,
        text
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-notes', selectedClientId] });
      setNewNote('');
      toast.success('Заметка добавлена');
    }
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">База клиентов</h2>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Поиск по имени или телефону..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead>Баллы</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Последний визит</TableHead>
              <TableHead>Всего визитов</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients?.map((client: any) => (
              <TableRow 
                key={client.id} 
                className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                onClick={() => setSelectedClientId(client.id)}
              >
                <TableCell className="font-medium text-gray-900">{client.name}</TableCell>
                <TableCell className="text-gray-600">{client.phone}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <Gift className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-gray-900">{client.loyaltyPoints}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-600">{client.email || '-'}</TableCell>
                <TableCell className="text-gray-600">
                  {client.bookings?.[0]?.startTime 
                    ? format(new Date(client.bookings[0].startTime), 'd MMMM yyyy', { locale: ru })
                    : 'Нет записей'}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50">
                    {client._count.bookings}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                    Профиль
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={!!selectedClientId} onOpenChange={(open) => !open && setSelectedClientId(null)}>
        <SheetContent className="sm:max-w-[500px] overflow-y-auto">
          <SheetHeader className="pb-6 border-b">
            <SheetTitle className="flex items-center gap-3 text-2xl">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                <User className="w-6 h-6" />
              </div>
              {clientDetails?.name}
            </SheetTitle>
          </SheetHeader>

          {isDetailsLoading ? (
            <div className="py-6 space-y-6">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : clientDetails && (
            <div className="py-6 space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-gray-50 space-y-1">
                  <div className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    Телефон
                  </div>
                  <div className="text-sm font-medium text-gray-900">{clientDetails.phone}</div>
                </div>
                <div className="p-4 rounded-xl bg-gray-50 space-y-1">
                  <div className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Email
                  </div>
                  <div className="text-sm font-medium text-gray-900">{clientDetails.email || 'Не указан'}</div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-pink-500" />
                  Бонусная программа
                </h3>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-100 flex justify-between items-center relative overflow-hidden">
                   <div className="relative z-10">
                     <p className="text-[10px] opacity-80 uppercase font-bold tracking-wider mb-1">Баланс баллов</p>
                     <p className="text-3xl font-black">{clientDetails.loyaltyPoints}</p>
                   </div>
                   <div className="relative z-10 text-right">
                     <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                        <Gift className="w-6 h-6" />
                     </div>
                   </div>
                   <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                </div>

                <div className="space-y-2">
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">История транзакций</p>
                   <div className="space-y-2">
                     {clientDetails.loyaltyTransactions?.map((tx: any) => (
                       <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm">
                         <div className="flex items-center gap-3">
                           <div className={cn(
                             "w-8 h-8 rounded-full flex items-center justify-center text-xs",
                             tx.points > 0 ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                           )}>
                             {tx.points > 0 ? '+' : '-'}
                           </div>
                           <div>
                             <p className="font-semibold text-slate-900">{tx.description || (tx.type === 'EARN' ? 'Начисление' : 'Списание')}</p>
                             <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                               <Clock className="w-3 h-3" />
                               {format(new Date(tx.createdAt), 'd MMM yyyy, HH:mm', { locale: ru })}
                             </p>
                           </div>
                         </div>
                         <div className={cn("font-bold", tx.points > 0 ? "text-emerald-600" : "text-red-900")}>
                           {tx.points > 0 ? `+${tx.points}` : tx.points}
                         </div>
                       </div>
                     ))}
                     {(!clientDetails.loyaltyTransactions || clientDetails.loyaltyTransactions.length === 0) && (
                       <div className="text-center py-6 border-2 border-dashed rounded-2xl text-slate-400 text-xs mt-2">
                         Транзакций пока нет
                       </div>
                     )}
                   </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Статистика
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 border rounded-lg">
                    <div className="text-xs text-gray-500">Всего визитов</div>
                    <div className="text-lg font-bold">{clientDetails.bookings.length}</div>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <div className="text-xs text-gray-500">Завершено</div>
                    <div className="text-lg font-bold text-emerald-600">
                      {clientDetails.bookings.filter((b: any) => b.status === 'COMPLETED').length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-amber-500" />
                  Заметки
                </h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Добавить заметку..." 
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && newNote && addNoteMutation.mutate(newNote)}
                    />
                    <Button 
                      size="icon" 
                      className="bg-blue-600 shrink-0"
                      disabled={!newNote || addNoteMutation.isPending}
                      onClick={() => addNoteMutation.mutate(newNote)}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                    {notes?.map((note: any) => (
                      <div key={note.id} className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-sm text-amber-900">
                        {note.text}
                        <div className="text-[10px] text-amber-600 mt-1">
                          {format(new Date(note.createdAt), 'd MMM yyyy, HH:mm', { locale: ru })}
                        </div>
                      </div>
                    ))}
                    {notes?.length === 0 && (
                      <div className="text-center py-4 text-gray-400 text-xs italic">
                        Нет заметок о клиенте
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-500" />
                  История записей
                </h3>
                <div className="space-y-3">
                  {clientDetails.bookings.map((booking: any) => (
                    <div key={booking.id} className="p-4 border rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {booking.status === 'COMPLETED' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          ) : booking.status === 'CANCELLED' ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <Calendar className="w-4 h-4 text-amber-500" />
                          )}
                          <span className="text-sm font-semibold">
                            {format(new Date(booking.startTime), 'd MMMM yyyy, HH:mm', { locale: ru })}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {booking.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-600 mb-1">{booking.service?.name || 'Удаленная услуга'}</div>
                      <div className="text-xs text-gray-400">Мастер: {booking.staff?.name || 'Удаленный мастер'}</div>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  // Redirect to calendar or open booking modal
                  window.location.href = `/dashboard/${slug}?action=new-booking&clientId=${clientDetails.id}`;
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Новая запись
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
