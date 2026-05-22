import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfWeek, addDays, subDays, parse, isAfter } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface WeeklyScheduleProps {
  businessSlug: string;
  staffId: string;
  onSelectSlot: (date: Date, time: string) => void;
}

export function WeeklySchedule({ businessSlug, staffId, onSelectSlot }: WeeklyScheduleProps) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  const { data: weekData, isLoading } = useQuery({
    queryKey: ['week-schedule', businessSlug, staffId, weekStart],
    queryFn: async () => {
      const response = await fetch(
        `/api/businesses/${businessSlug}/week-schedule?staffId=${staffId}&startDate=${format(weekStart, 'yyyy-MM-dd')}`
      );
      if (!response.ok) throw new Error('Failed to fetch schedule');
      return response.json();
    }
  });
  
  const goToPrevWeek = () => setWeekStart(subDays(weekStart, 7));
  const goToNextWeek = () => setWeekStart(addDays(weekStart, 7));
  
  if (isLoading) return <Skeleton className="h-96 w-full" />;
  
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="sm" onClick={goToPrevWeek}>
          ← Пред. неделя
        </Button>
        
        <h3 className="font-semibold text-sm md:text-base">
          {format(weekStart, 'dd MMM', { locale: ru })} - {format(addDays(weekStart, 6), 'dd MMM yyyy', { locale: ru })}
        </h3>
        
        <Button variant="outline" size="sm" onClick={goToNextWeek}>
          След. неделя →
        </Button>
      </div>
      
      <div className="overflow-x-auto no-scrollbar pb-2">
        <div className="grid grid-cols-7 gap-1 min-w-[600px] md:min-w-0">
        {weekData?.days.map((day: any, index: number) => (
          <div key={index} className="text-center">
            <div className="mb-2 pb-2 border-b">
              <p className="font-semibold text-[10px] md:text-xs uppercase text-gray-500">
                {format(new Date(day.date), 'EEE', { locale: ru })}
              </p>
              <p className="text-xs md:text-sm font-medium">
                {format(new Date(day.date), 'dd.MM')}
              </p>
            </div>
            
            <div className="space-y-1 max-h-[400px] overflow-y-auto scrollbar-hide">
              {day.isWorkingDay ? (
                day.slots.map((slot: any, slotIndex: number) => (
                  <button
                    key={slotIndex}
                    onClick={() => slot.available && onSelectSlot(new Date(day.date), slot.time)}
                    disabled={!slot.available}
                    className={cn(
                      "w-full text-[10px] md:text-xs py-1.5 px-0.5 rounded transition-all border",
                      slot.available
                        ? "bg-green-50 hover:bg-green-100 text-green-700 border-green-200 cursor-pointer"
                        : "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                    )}
                  >
                    {slot.time}
                  </button>
                ))
              ) : (
                <div className="text-[10px] text-gray-400 py-4 italic">
                  Вых.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      </div>
      
      <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t text-[10px] md:text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-green-50 border border-green-200 rounded" />
          <span>Свободно</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-gray-50 border border-gray-100 rounded" />
          <span>Занято / Прошло</span>
        </div>
      </div>
    </div>
  );
}
