import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Scissors, Clock, Banknote, CheckCircle2, XCircle } from 'lucide-react';

const serviceSchema = z.object({
  name: z.string().min(3, 'Минимум 3 символа'),
  description: z.string().optional(),
  durationMinutes: z.coerce.number().min(5).max(300),
  price: z.coerce.number().min(0, 'Цена не может быть отрицательной'),
  isActive: z.boolean(),
  paddingAfter: z.coerce.number().min(0).default(0),
  isGroupService: z.boolean().default(false),
  maxParticipants: z.coerce.number().min(1).optional(),
  enableDynamicPricing: z.boolean().default(false),
  pricingRules: z.any().optional(),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

export default function ServicesManager() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);

  const { data: business } = useQuery({
    queryKey: ['business', slug],
    queryFn: async () => {
      const res = await axios.get(`/api/businesses/${slug}`);
      return res.data;
    },
  });

  const { data: services, isLoading } = useQuery({
    queryKey: ['services', slug],
    queryFn: async () => {
      if (!business?.id) return [];
      const res = await axios.get(`/api/services?businessId=${business.id}`);
      return res.data;
    },
    enabled: !!business?.id,
  });

  const form = useForm<any>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      description: '',
      durationMinutes: 30,
      price: 1000,
      isActive: true,
      paddingAfter: 0,
      isGroupService: false,
      maxParticipants: 1,
      enableDynamicPricing: false,
      pricingRules: {
        peak: { days: [5, 6], hours: [17, 21], multiplier: 1.2 },
        offPeak: { days: [1, 2], hours: [10, 14], multiplier: 0.8 }
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: ServiceFormValues) => {
      if (editingService) {
        await axios.patch(`/api/services/${editingService.id}`, values);
      } else {
        await axios.post('/api/services', { ...values, businessId: business.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', slug] });
      toast.success(editingService ? 'Услуга обновлена' : 'Услуга добавлена');
      handleClose();
    },
    onError: () => {
      toast.error('Ошибка при сохранении');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services', slug] });
      toast.success('Услуга удалена');
    },
  });

  const handleEdit = (service: any) => {
    setEditingService(service);
    form.reset({
      name: service.name,
      description: service.description || '',
      durationMinutes: service.durationMinutes,
      price: service.price,
      isActive: service.isActive,
      paddingAfter: service.paddingAfter || 0,
      isGroupService: service.isGroupService || false,
      maxParticipants: service.maxParticipants || 1,
      enableDynamicPricing: service.enableDynamicPricing || false,
      pricingRules: service.pricingRules || {
        peak: { days: [5, 6], hours: [17, 21], multiplier: 1.2 },
        offPeak: { days: [1, 2], hours: [10, 14], multiplier: 0.8 }
      }
    });
    setIsDialogOpen(true);
  };

  const handleClose = () => {
    setIsDialogOpen(false);
    setEditingService(null);
    form.reset({
      name: '',
      description: '',
      durationMinutes: 30,
      price: 1000,
      isActive: true,
      paddingAfter: 0,
      isGroupService: false,
      maxParticipants: 1,
      enableDynamicPricing: false,
      pricingRules: {
        peak: { days: [5, 6], hours: [17, 21], multiplier: 1.2 },
        offPeak: { days: [1, 2], hours: [10, 14], multiplier: 0.8 }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Управление услугами</h2>
          <p className="text-sm text-gray-500">Настройте список услуг, которые могут выбрать ваши клиенты</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Добавить услугу
        </Button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="w-[300px]">Название</TableHead>
              <TableHead>Длительность</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-gray-500">
                  Услуги не добавлены
                </TableCell>
              </TableRow>
            ) : (
              services?.map((service: any) => (
                <TableRow key={service.id} className={!service.isActive ? 'opacity-60 bg-gray-50/50' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                        <Scissors className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{service.name}</div>
                        {service.description && (
                          <div className="text-xs text-gray-500 line-clamp-1">{service.description}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400" />
                      {service.durationMinutes} мин
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
                      <Banknote className="w-4 h-4 text-emerald-500" />
                      {service.price} ₽
                    </div>
                  </TableCell>
                  <TableCell>
                    {service.isActive ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Активна
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
                        <XCircle className="w-4 h-4" />
                        Неактивна
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => handleEdit(service)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8 text-gray-400 hover:text-red-600"
                        onClick={() => {
                          if (confirm('Удалить эту услугу?')) {
                            deleteMutation.mutate(service.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingService ? 'Редактировать услугу' : 'Добавить новую услугу'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название услуги</FormLabel>
                    <FormControl>
                      <Input placeholder="Например: Мужская стрижка" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Описание (необязательно)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Краткое описание услуги для клиентов" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Длительность (мин)</FormLabel>
                      <FormControl>
                        <Input type="number" step={5} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="paddingAfter"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Буфер после (мин)</FormLabel>
                      <FormControl>
                        <Input type="number" step={5} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Цена (₽)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-2 mt-8">
                      <FormControl>
                        <Checkbox
                          checked={!!field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Активна</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="isGroupService"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={!!field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Групповая услуга</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                {form.watch('isGroupService') && (
                  <FormField
                    control={form.control}
                    name="maxParticipants"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Макс. участников</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <FormField
                control={form.control}
                name="enableDynamicPricing"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Динамическое ценообразование</FormLabel>
                      <p className="text-xs text-gray-500">Изменение цены в пиковые часы</p>
                    </div>
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>Отмена</Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
