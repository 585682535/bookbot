import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, User, Phone, Clock, Calendar, Image as ImageIcon, Upload, X } from 'lucide-react';

const staffSchema = z.object({
  name: z.string().min(2, 'Минимум 2 символа'),
  phone: z.string().min(10, 'Минимум 10 цифр'),
  workingHours: z.any(),
  isActive: z.boolean(),
});

type StaffFormValues = z.infer<typeof staffSchema>;

const DAYS = [
  { id: 'mon', label: 'Понедельник' },
  { id: 'tue', label: 'Вторник' },
  { id: 'wed', label: 'Среда' },
  { id: 'thu', label: 'Четверг' },
  { id: 'fri', label: 'Пятница' },
  { id: 'sat', label: 'Суббота' },
  { id: 'sun', label: 'Воскресенье' },
];

export default function StaffManager() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'portfolio'>('info');
  const [selectedStaffForPortfolio, setSelectedStaffForPortfolio] = useState<any>(null);

  const { data: photos, isLoading: isLoadingPhotos } = useQuery({
    queryKey: ['staff-photos', selectedStaffForPortfolio?.id],
    queryFn: async () => {
      const res = await axios.get(`/api/staff/${selectedStaffForPortfolio.id}/photos`);
      return res.data;
    },
    enabled: !!selectedStaffForPortfolio?.id,
  });

  const addPhotoMutation = useMutation({
    mutationFn: async (data: { imageUrl?: string, caption?: string, category?: string }) => {
      await axios.post(`/api/staff/${selectedStaffForPortfolio.id}/photos`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-photos', selectedStaffForPortfolio?.id] });
      toast.success('Фото добавлено');
    }
  });

  const handleOpenPortfolio = (member: any) => {
    setSelectedStaffForPortfolio(member);
    setActiveTab('portfolio');
    setIsDialogOpen(true);
  };

  const { data: business } = useQuery({
    queryKey: ['business', slug],
    queryFn: async () => {
      const res = await axios.get(`/api/businesses/${slug}`);
      console.log("Fetched business:", res.data);
      return res.data;
    },
  });

  const { data: staff, isLoading } = useQuery({
    queryKey: ['staff', slug],
    queryFn: async () => {
      if (!business?.id) return [];
      const res = await axios.get(`/api/staff?businessId=${business.id}`);
      return res.data;
    },
    enabled: !!business?.id,
  });

  const form = useForm<any>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: '',
      phone: '',
      isActive: true,
      workingHours: DAYS.reduce((acc, day) => ({
        ...acc,
        [day.id]: { start: '09:00', end: '18:00', isWorking: day.id !== 'sun' }
      }), {}),
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: StaffFormValues) => {
      console.log("Saving staff with values:", values);
      if (!business?.id) {
        throw new Error('Данные о бизнесе еще не загружены. Пожалуйста, подождите или обновите страницу.');
      }
      if (editingStaff) {
        return axios.patch(`/api/staff/${editingStaff.id}`, values);
      } else {
        return axios.post('/api/staff', { ...values, businessId: business.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', slug] });
      toast.success(editingStaff ? 'Сотрудник обновлен' : 'Сотрудник добавлен');
      handleClose();
    },
    onError: (error: any) => {
      console.error("Save error:", error);
      const message = error.response?.data?.details || error.message || 'Ошибка при сохранении';
      toast.error(`Ошибка при сохранении: ${message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/staff/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', slug] });
      toast.success('Сотрудник удален');
    },
  });

  const handleEdit = (member: any) => {
    setEditingStaff(member);
    form.reset({
      name: member.name,
      phone: member.phone,
      isActive: member.isActive,
      workingHours: member.workingHours || form.getValues('workingHours'),
    });
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingStaff(null);
    setSelectedStaffForPortfolio(null);
    setActiveTab('info');
    form.reset();
  };

  if (isLoading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Управление мастерами</h2>
          <p className="text-sm text-gray-500">Добавляйте сотрудников и настраивайте их графики работы</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Добавить мастера
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff?.map((member: any) => (
          <Card key={member.id} className={!member.isActive ? 'opacity-60 grayscale' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <User className="w-4 h-4" />
                </div>
                {member.name}
              </CardTitle>
              <Badge variant={member.isActive ? 'default' : 'secondary'} className={member.isActive ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100' : ''}>
                {member.isActive ? 'Активен' : 'Неактивен'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone className="w-4 h-4 text-gray-400" />
                {member.phone}
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  График работы
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                  {DAYS.slice(0, 5).map(day => (
                    <div key={day.id} className="flex justify-between">
                      <span>{day.label.slice(0, 2)}:</span>
                      <span className="font-medium">
                        {member.workingHours?.[day.id]?.isWorking 
                          ? `${member.workingHours[day.id].start}-${member.workingHours[day.id].end}`
                          : 'Выходной'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(member)}>
                  <Pencil className="w-3 h-3 mr-2" />
                  Изменить
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleOpenPortfolio(member)}>
                  <ImageIcon className="w-3 h-3 mr-2" />
                  Портфолио
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => {
                    if (confirm('Удалить сотрудника?')) {
                      deleteMutation.mutate(member.id);
                    }
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {activeTab === 'info' 
                ? (editingStaff ? 'Редактировать мастера' : 'Добавить нового мастера')
                : `Портфолио: ${selectedStaffForPortfolio?.name}`
              }
            </DialogTitle>
          </DialogHeader>

          {activeTab === 'info' ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Имя</FormLabel>
                        <FormControl>
                          <Input placeholder="Иван Иванов" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Телефон</FormLabel>
                        <FormControl>
                          <Input placeholder="+7 999 000-00-00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <FormLabel className="text-base">Рабочие часы</FormLabel>
                  <div className="space-y-3">
                    {DAYS.map((day) => (
                      <div key={day.id} className="flex items-center gap-4 p-3 rounded-lg border bg-gray-50/50">
                        <div className="w-32 flex items-center gap-2">
                          <Checkbox 
                            checked={!!form.watch(`workingHours.${day.id}.isWorking`)}
                            onCheckedChange={(checked) => {
                              form.setValue(`workingHours.${day.id}.isWorking`, !!checked);
                            }}
                          />
                          <span className="text-sm font-medium">{day.label}</span>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-1">
                          <Input 
                            type="time" 
                            className="h-8"
                            disabled={!form.watch(`workingHours.${day.id}.isWorking`)}
                            {...form.register(`workingHours.${day.id}.start`)}
                          />
                          <span className="text-gray-400">-</span>
                          <Input 
                            type="time" 
                            className="h-8"
                            disabled={!form.watch(`workingHours.${day.id}.isWorking`)}
                            {...form.register(`workingHours.${day.id}.end`)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={!!field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Активен</FormLabel>
                        <p className="text-xs text-gray-500">
                          Только активные мастера доступны для записи
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleClose}>Отмена</Button>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          ) : (
            <div className="space-y-6 py-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-semibold">Работы мастера</h4>
                <Button size="sm" onClick={() => addPhotoMutation.mutate({ caption: 'Новая работа' })}>
                  <Upload className="w-4 h-4 mr-2" />
                  Загрузить фото
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {isLoadingPhotos ? (
                  <Skeleton className="h-32 w-full col-span-3" />
                ) : photos?.length === 0 ? (
                  <div className="col-span-3 text-center py-10 text-gray-400 border-2 border-dashed rounded-xl">
                    Нет загруженных работ
                  </div>
                ) : (
                  photos?.map((photo: any) => (
                    <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden border">
                      <img 
                        src={photo.imageUrl} 
                        alt={photo.caption} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button size="icon" variant="destructive" className="h-8 w-8">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleClose}>Закрыть</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
