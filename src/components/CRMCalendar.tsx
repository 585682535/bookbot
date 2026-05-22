import React, { useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import ruLocale from '@fullcalendar/core/locales/ru';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarIcon, Clock, User, Phone, Mail, FileText, CheckCircle, XCircle, Trash2 } from 'lucide-react';

const statusColors: Record<string, string> = {
  CONFIRMED: '#10b981',
  PENDING: '#fbbf24',
  CANCELLED: '#ef4444',
  COMPLETED: '#9ca3af',
  NO_SHOW: '#a855f7',
};

const statusLabels: Record<string, string> = {
  CONFIRMED: 'Подтверждена',
  PENDING: 'Ожидает',
  CANCELLED: 'Отменена',
  COMPLETED: 'Завершена',
  NO_SHOW: 'Не пришел',
};

export default function CRMCalendar() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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
      setIsDetailsOpen(false);
    },
    onError: () => {
      toast.error('Ошибка при обновлении статуса');
    },
  });

  const events = bookings?.map((b: any) => ({
    id: b.id,
    title: `${b.clientName} - ${b.service?.name || 'Удаленная услуга'}`,
    start: b.startTime,
    end: b.endTime,
    backgroundColor: statusColors[b.status] || '#3b82f6',
    extendedProps: b,
  })) || [];

  const handleEventClick = (info: any) => {
    setSelectedBooking(info.event.extendedProps);
    setIsDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Календарь записей</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(statusLabels).map(([status, label]) => (
            <div key={status} className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl">
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ backgroundColor: statusColors[status] }}
              />
              <span className="text-[11px] font-medium text-slate-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="calendar-container overflow-x-auto">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={window.innerWidth < 768 ? 'timeGridDay' : 'timeGridWeek'}
          headerToolbar={window.innerWidth < 768 ? {
            left: 'prev,next',
            center: 'title',
            right: 'timeGridDay,dayGridMonth'
          } : {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          locale={ruLocale}
          events={events}
          eventClick={handleEventClick}
          slotMinTime="09:00:00"
          slotMaxTime="21:00:00"
          allDaySlot={false}
          height="auto"
          nowIndicator={true}
          slotDuration="00:30:00"
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
            meridiem: false,
          }}
        />
      </div>

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Детали записи
            </DialogTitle>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase">Клиент</label>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <User className="w-4 h-4 text-gray-400" />
                    {selectedBooking.clientName}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase">Статус</label>
                  <div>
                    <Badge 
                      style={{ backgroundColor: statusColors[selectedBooking.status] }}
                      className="text-white border-none"
                    >
                      {statusLabels[selectedBooking.status]}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase">Телефон</label>
                  <a href={`tel:${selectedBooking.clientPhone}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    <Phone className="w-4 h-4" />
                    {selectedBooking.clientPhone}
                  </a>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase">Email</label>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    {selectedBooking.clientEmail || 'Не указан'}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">{selectedBooking.service?.name || 'Удаленная услуга'}</span>
                  <span className="text-sm font-bold text-gray-900">{selectedBooking.service?.price || 0} ₽</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="w-3 h-3" />
                    {format(new Date(selectedBooking.startTime), 'd MMMM yyyy', { locale: ru })}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(selectedBooking.startTime), 'HH:mm')} - {format(new Date(selectedBooking.endTime), 'HH:mm')}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <User className="w-3 h-3" />
                  Мастер: {selectedBooking.staff?.name || 'Любой'}
                </div>
              </div>

              {selectedBooking.notes && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 uppercase">Заметки</label>
                  <p className="text-sm text-gray-600 italic">"{selectedBooking.notes}"</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {selectedBooking.status === 'PENDING' && (
                  <Button 
                    onClick={() => updateStatusMutation.mutate({ id: selectedBooking.id, status: 'CONFIRMED' })}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Подтвердить
                  </Button>
                )}
                {selectedBooking.status !== 'CANCELLED' && (
                  <Button 
                    variant="outline"
                    onClick={() => updateStatusMutation.mutate({ id: selectedBooking.id, status: 'CANCELLED' })}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Отменить
                  </Button>
                )}
                <Button variant="ghost" className="text-gray-500 ml-auto">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Удалить
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <style>{`
        .calendar-container .fc {
          --fc-border-color: #f3f4f6;
          --fc-button-bg-color: #ffffff;
          --fc-button-border-color: #e5e7eb;
          --fc-button-text-color: #374151;
          --fc-button-hover-bg-color: #f9fafb;
          --fc-button-active-bg-color: #f3f4f6;
          --fc-today-bg-color: #eff6ff;
          font-family: inherit;
        }
        .calendar-container .fc-toolbar-title {
          font-size: 1.25rem !important;
          font-weight: 700 !important;
          color: #111827;
          text-transform: capitalize;
        }
        .calendar-container .fc-col-header-cell-cushion {
          padding: 12px 4px !important;
          font-weight: 600 !important;
          color: #4b5563;
          text-decoration: none !important;
        }
        .calendar-container .fc-event {
          border: none !important;
          padding: 2px 4px !important;
          border-radius: 4px !important;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .calendar-container .fc-event:hover {
          transform: scale(1.02);
        }
        .calendar-container .fc-timegrid-slot {
          height: 3em !important;
        }
      `}</style>
    </div>
  );
}
