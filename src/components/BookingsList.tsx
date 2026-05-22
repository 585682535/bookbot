import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Search, Filter, Phone, Check, X, Eye, Calendar, History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const statusColors: Record<string, string> = {
  CONFIRMED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  PENDING: 'bg-amber-100 text-amber-700 border-amber-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
  COMPLETED: 'bg-gray-100 text-gray-700 border-gray-200',
  NO_SHOW: 'bg-purple-100 text-purple-700 border-purple-200',
};

const statusLabels: Record<string, string> = {
  CONFIRMED: 'Подтверждена',
  PENDING: 'Ожидает',
  CANCELLED: 'Отменена',
  COMPLETED: 'Завершена',
  NO_SHOW: 'Не пришел',
};

export default function BookingsList() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  const { data: audits, isLoading: isLoadingAudits } = useQuery({
    queryKey: ['booking-audits', selectedBooking?.id],
    queryFn: async () => {
      const res = await axios.get(`/api/bookings/${selectedBooking.id}/audits`);
      return res.data;
    },
    enabled: !!selectedBooking?.id && isAuditOpen,
  });

  const handleShowAudit = (booking: any) => {
    setSelectedBooking(booking);
    setIsAuditOpen(true);
  };

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['bookings', slug],
    queryFn: async () => {
      const res = await axios.get(`/api/businesses/${slug}/bookings`);
      return res.data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await axios.patch(`/api/bookings/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', slug] });
      toast.success('Статус обновлен');
    },
  });

  const filteredBookings = bookings?.filter((b: any) => {
    const matchesSearch = b.clientName.toLowerCase().includes(search.toLowerCase()) || 
                         b.clientPhone.includes(search);
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="border rounded-lg overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full border-b" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Список записей</h2>
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
              placeholder="Поиск по имени или телефону..." 
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <Filter className="w-4 h-4 mr-2 text-gray-400" />
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Все статусы</SelectItem>
              <SelectItem value="PENDING">Ожидают</SelectItem>
              <SelectItem value="CONFIRMED">Подтверждены</SelectItem>
              <SelectItem value="COMPLETED">Завершены</SelectItem>
              <SelectItem value="CANCELLED">Отменены</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="font-semibold">Дата и время</TableHead>
              <TableHead className="font-semibold">Клиент</TableHead>
              <TableHead className="font-semibold">Услуга</TableHead>
              <TableHead className="font-semibold">Мастер</TableHead>
              <TableHead className="font-semibold">Статус</TableHead>
              <TableHead className="text-right font-semibold">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredBookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-gray-500">
                  Записи не найдены
                </TableCell>
              </TableRow>
            ) : (
              filteredBookings.map((booking: any) => (
                <TableRow key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">
                        {format(new Date(booking.startTime), 'd MMMM', { locale: ru })}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(booking.startTime), 'HH:mm')} - {format(new Date(booking.endTime), 'HH:mm')}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900">{booking.clientName}</span>
                      <a href={`tel:${booking.clientPhone}`} className="text-xs text-blue-600 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {booking.clientPhone}
                      </a>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-700">{booking.service?.name || 'Удаленная услуга'}</span>
                      <span className="text-xs font-bold text-gray-500">{booking.service?.price || 0} ₽</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">{booking.staff?.name || 'Удаленный мастер'}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${statusColors[booking.status]} border`}>
                      {statusLabels[booking.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {booking.status === 'CONFIRMED' && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={() => updateStatusMutation.mutate({ id: booking.id, status: 'COMPLETED' })}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                        {booking.status === 'PENDING' && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => updateStatusMutation.mutate({ id: booking.id, status: 'CONFIRMED' })}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      {booking.status !== 'CANCELLED' && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => updateStatusMutation.mutate({ id: booking.id, status: 'CANCELLED' })}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400" onClick={() => handleShowAudit(booking)}>
                        <History className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isAuditOpen} onOpenChange={setIsAuditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>История изменений записи</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isLoadingAudits ? (
              <Skeleton className="h-32 w-full" />
            ) : audits?.length === 0 ? (
              <div className="text-center py-10 text-gray-500">История изменений пуста</div>
            ) : (
              <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                {audits?.map((audit: any) => (
                  <div key={audit.id} className="relative flex items-start gap-4 pl-10">
                    <div className="absolute left-0 w-10 h-10 rounded-full bg-blue-50 border-2 border-white flex items-center justify-center text-blue-600 shadow-sm">
                      <History className="w-4 h-4" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-900">{audit.action}</span>
                        <span className="text-[10px] text-gray-400">
                          {format(new Date(audit.createdAt), 'd MMM HH:mm', { locale: ru })}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border">
                        <pre className="whitespace-pre-wrap font-sans">
                          {JSON.stringify(audit.details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
