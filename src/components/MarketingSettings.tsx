import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Ticket, CreditCard, Trash2, Gift, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface MarketingSettingsProps {
  businessId: string;
}

export default function MarketingSettings({ businessId }: MarketingSettingsProps) {
  const queryClient = useQueryClient();
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [isAddingGift, setIsAddingGift] = useState(false);

  const { data: services } = useQuery({
    queryKey: ['services', businessId],
    queryFn: async () => {
      const res = await axios.get(`/api/services?businessId=${businessId}`);
      return res.data;
    }
  });

  const { data: subscriptions, isLoading: subsLoading } = useQuery({
    queryKey: ['subscriptions', businessId],
    queryFn: async () => {
      const res = await axios.get(`/api/subscriptions?businessId=${businessId}`);
      return res.data;
    }
  });

  const createSubMutation = useMutation({
    mutationFn: async (data: any) => axios.post('/api/subscriptions', { ...data, businessId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', businessId] });
      setIsAddingSub(false);
      toast.success('Абонемент создан');
    }
  });

  const createGiftMutation = useMutation({
    mutationFn: async (data: any) => axios.post('/api/gift-certificates/create', { ...data, businessId }),
    onSuccess: () => {
      setIsAddingGift(false);
      toast.success('Сертификат создан');
    }
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Subscriptions Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                Абонементы
              </CardTitle>
              <CardDescription>Пакеты услуг для лояльных клиентов</CardDescription>
            </div>
            <Button size="sm" onClick={() => setIsAddingSub(true)}>
              <Plus className="w-4 h-4 mr-1" /> Добавить
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAddingSub && (
              <form className="p-4 border rounded-lg bg-slate-50 space-y-3" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createSubMutation.mutate(Object.fromEntries(formData));
              }}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label>Название</Label>
                    <Input name="name" placeholder="Напр. 10 стрижек" required />
                  </div>
                  <div className="col-span-2">
                    <Label>Услуга</Label>
                    <Select name="serviceId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите услугу" />
                      </SelectTrigger>
                      <SelectContent>
                        {services?.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Кол-во визитов</Label>
                    <Input name="totalVisits" type="number" defaultValue="10" required />
                  </div>
                  <div>
                    <Label>Срок (дней)</Label>
                    <Input name="validDays" type="number" defaultValue="90" required />
                  </div>
                  <div>
                    <Label>Цена (₽)</Label>
                    <Input name="price" type="number" required />
                  </div>
                  <div>
                    <Label>Цена без скидки (₽)</Label>
                    <Input name="originalPrice" type="number" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingSub(false)}>Отмена</Button>
                  <Button type="submit" size="sm" disabled={createSubMutation.isPending}>Создать</Button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {subscriptions?.map((sub: any) => (
                <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                  <div>
                    <p className="font-medium">{sub.name}</p>
                    <p className="text-xs text-slate-500">{sub.service.name} • {sub.totalVisits} визитов • {sub.validDays} дней</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">{sub.price} ₽</p>
                    {sub.originalPrice && <p className="text-[10px] text-slate-400 line-through">{sub.originalPrice} ₽</p>}
                  </div>
                </div>
              ))}
              {subscriptions?.length === 0 && !isAddingSub && (
                <p className="text-center py-8 text-slate-400 text-sm">У вас пока нет активных абонементов</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gift Certificates Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5 text-purple-600" />
                Подарочные сертификаты
              </CardTitle>
              <CardDescription>Выпуск и управление сертификатами</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => setIsAddingGift(true)}>
              <Plus className="w-4 h-4 mr-1" /> Выпустить
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAddingGift && (
              <form className="p-4 border rounded-lg bg-purple-50/30 space-y-3" onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                createGiftMutation.mutate(Object.fromEntries(formData));
              }}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Номинал (₽)</Label>
                    <Input name="amount" type="number" placeholder="5000" required />
                  </div>
                  <div>
                    <Label>Кто купил</Label>
                    <Input name="purchasedByName" placeholder="Имя" required />
                  </div>
                  <div className="col-span-2">
                    <Label>Получатель (Имя)</Label>
                    <Input name="recipientName" placeholder="Кому подарок" required />
                  </div>
                  <div className="col-span-2">
                    <Label>Email получателя (для отправки)</Label>
                    <Input name="recipientEmail" type="email" placeholder="email@example.com" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingGift(false)}>Отмена</Button>
                  <Button type="submit" size="sm" className="bg-purple-600 hover:bg-purple-700" disabled={createGiftMutation.isPending}>
                    {createGiftMutation.isPending ? 'Выпуск...' : 'Выпустить'}
                  </Button>
                </div>
              </form>
            )}

            <div className="bg-slate-50 rounded-lg p-4 border border-dashed border-slate-300">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Статистика сертификатов</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded border">
                  <p className="text-[10px] text-slate-400 uppercase">Активных</p>
                  <p className="text-xl font-bold">0</p>
                </div>
                <div className="bg-white p-3 rounded border">
                  <p className="text-[10px] text-slate-400 uppercase">Сумма</p>
                  <p className="text-xl font-bold">0 ₽</p>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Сертификаты можно продавать через виджет или выпускать вручную.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
