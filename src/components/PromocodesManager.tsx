import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Ticket, Calendar as CalendarIcon, Percent, RussianRuble } from 'lucide-react';
import { format } from 'date-fns';

export default function PromocodesManager() {
  const { slug } = useParams();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: business } = useQuery({
    queryKey: ['business', slug],
    queryFn: async () => {
      const res = await axios.get(`/api/businesses/${slug}`);
      return res.data;
    },
  });

  const { data: promocodes, isLoading } = useQuery({
    queryKey: ['promocodes', business?.id],
    queryFn: async () => {
      const res = await axios.get(`/api/promocodes?businessId=${business.id}`);
      return res.data;
    },
    enabled: !!business?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await axios.post('/api/promocodes', { ...data, businessId: business.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promocodes', business?.id] });
      setIsCreateOpen(false);
      toast.success('Промокод создан');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/promocodes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promocodes', business?.id] });
      toast.success('Промокод удален');
    },
  });

  if (isLoading) return <div className="p-8 text-center">Загрузка...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Промокоды</h2>
          <p className="text-sm text-slate-500">Управляйте скидками и акциями для ваших клиентов</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger render={<Button className="bg-blue-600 hover:bg-blue-700" />}>
            <Plus className="w-4 h-4 mr-2" />
            Создать промокод
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Новый промокод</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              createMutation.mutate({
                code: formData.get('code'),
                discountType: formData.get('discountType'),
                discountValue: parseFloat(formData.get('discountValue') as string),
                minOrderAmount: parseFloat(formData.get('minOrderAmount') as string) || null,
                maxUses: parseInt(formData.get('maxUses') as string) || null,
                validFrom: new Date().toISOString(),
                validUntil: formData.get('validUntil') ? new Date(formData.get('validUntil') as string).toISOString() : null,
              });
            }} className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Код (например: FIRST20)</label>
                <Input name="code" required placeholder="FIRST20" className="uppercase" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Тип скидки</label>
                  <Select name="discountType" defaultValue="percent">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Процент (%)</SelectItem>
                      <SelectItem value="fixed">Сумма (₽)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Значение</label>
                  <Input name="discountValue" type="number" required placeholder="20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Мин. сумма заказа</label>
                  <Input name="minOrderAmount" type="number" placeholder="0" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Макс. использований</label>
                  <Input name="maxUses" type="number" placeholder="Безлимит" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Действует до</label>
                <Input name="validUntil" type="date" />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? 'Создание...' : 'Создать'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Код</TableHead>
                <TableHead>Скидка</TableHead>
                <TableHead>Использовано</TableHead>
                <TableHead>Действует до</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promocodes?.map((promo: any) => (
                <TableRow key={promo.id}>
                  <TableCell className="font-bold">
                    <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                      {promo.code}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {promo.discountType === 'percent' ? <Percent className="w-3 h-3" /> : <RussianRuble className="w-3 h-3" />}
                      {promo.discountValue}
                      {promo.discountType === 'percent' ? '%' : '₽'}
                    </div>
                  </TableCell>
                  <TableCell>
                    {promo.usedCount} {promo.maxUses ? `/ ${promo.maxUses}` : ''}
                  </TableCell>
                  <TableCell>
                    {promo.validUntil ? format(new Date(promo.validUntil), 'dd.MM.yyyy') : 'Бессрочно'}
                  </TableCell>
                  <TableCell>
                    {promo.isActive ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Активен</Badge>
                    ) : (
                      <Badge variant="secondary">Неактивен</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => deleteMutation.mutate(promo.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {promocodes?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                    <Ticket className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    Промокодов пока нет
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
