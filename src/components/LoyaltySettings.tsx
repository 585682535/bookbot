import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { Loader2, Gift, Users, Share2, Award, Zap } from 'lucide-react';

export default function LoyaltySettings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    loyaltyEnabled: false,
    loyaltyPercent: 10,
    loyaltyMaxSpend: 50,
    loyaltyExpireDays: 0,
    isReferralEnabled: false,
    referralRewardPercent: 10
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/business/loyalty-settings', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ownerToken')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSettings({
          ...data,
          loyaltyExpireDays: data.loyaltyExpireDays || 0,
          isReferralEnabled: data.isReferralEnabled ?? false,
          referralRewardPercent: data.referralRewardPercent ?? 10
        });
      }
    } catch (error) {
      toast.error('Ошибка загрузки настроек');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/business/loyalty-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ownerToken')}`
        },
        body: JSON.stringify({
          ...settings,
          loyaltyExpireDays: settings.loyaltyExpireDays > 0 ? settings.loyaltyExpireDays : null
        })
      });

      if (response.ok) {
        toast.success('Настройки лояльности сохранены');
      } else {
        toast.error('Ошибка при сохранении');
      }
    } catch (error) {
      toast.error('Ошибка сервера');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-100 shadow-sm rounded-3xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Программа лояльности</CardTitle>
              <CardDescription>Настройте систему бонусов и поощрений для ваших клиентов</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-8">
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100">
            <div className="space-y-0.5">
              <Label className="text-base font-bold text-blue-900">Включить программу лояльности</Label>
              <p className="text-sm text-blue-700/70">
                Клиенты будут получать баллы за каждый визит и смогут ими оплачивать услуги
              </p>
            </div>
            <Switch
              checked={settings.loyaltyEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, loyaltyEnabled: checked })}
            />
          </div>

          <div className={`space-y-8 transition-opacity duration-300 ${!settings.loyaltyEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Начислять баллы от суммы визита
                </Label>
                <span className="text-lg font-bold text-blue-600">{settings.loyaltyPercent}%</span>
              </div>
              <Slider
                value={[settings.loyaltyPercent]}
                min={1}
                max={30}
                step={1}
                onValueChange={(val) => setSettings({ ...settings, loyaltyPercent: val[0] })}
                className="py-2"
              />
              <p className="text-xs text-slate-500">
                Например: при визите на 1000 ₽ клиенту будет начислено {Math.floor(1000 * settings.loyaltyPercent / 100)} баллов
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Макс. оплата баллами (%)
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={10}
                    max={100}
                    value={settings.loyaltyMaxSpend}
                    onChange={(e) => setSettings({ ...settings, loyaltyMaxSpend: parseInt(e.target.value) || 0 })}
                    className="rounded-xl pl-4 pr-10 h-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                </div>
                <p className="text-xs text-slate-500">
                  Какой процент от стоимости услуги можно оплатить бонусами
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Баллы сгорают через (дней)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={settings.loyaltyExpireDays}
                  onChange={(e) => setSettings({ ...settings, loyaltyExpireDays: parseInt(e.target.value) || 0 })}
                  placeholder="Не сгорают"
                  className="rounded-xl h-12"
                />
                <p className="text-xs text-slate-500">
                  Оставьте 0 или пустым, если баллы бессрочные
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <Button
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 rounded-2xl font-bold shadow-lg shadow-blue-200"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Сохранить настройки
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-100 shadow-sm rounded-3xl overflow-hidden mt-6">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Реферальная программа</CardTitle>
              <CardDescription>Стимулируйте сарафанное радио через рекомендации</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-8">
          <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
            <div className="space-y-0.5">
              <Label className="text-base font-bold text-indigo-900">Включить рекомендации</Label>
              <p className="text-sm text-indigo-700/70">
                Клиенты смогут делиться ссылкой и получать баллы за записи друзей
              </p>
            </div>
            <Switch
              checked={settings.isReferralEnabled}
              onCheckedChange={(checked) => setSettings({ ...settings, isReferralEnabled: checked })}
            />
          </div>

          <div className={`space-y-8 transition-opacity duration-300 ${!settings.isReferralEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Общая скидка при рекомендации
                </Label>
                <span className="text-lg font-bold text-indigo-600">{settings.referralRewardPercent}%</span>
              </div>
              <Slider
                value={[settings.referralRewardPercent]}
                min={1}
                max={50}
                step={1}
                onValueChange={(val) => setSettings({ ...settings, referralRewardPercent: val[0] })}
                className="py-2"
              />
              <p className="text-xs text-slate-500">
                Эта скидка будет распределена между пригласившим и другом. Например, если 10%:
                друг может получить 5% скидки, а пригласивший — 5% баллами.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-100 shadow-sm rounded-3xl border-dashed">
        <CardContent className="p-6">
          <div className="flex gap-4 text-slate-600 italic text-sm">
            <div className="flex-shrink-0 text-xl">💡</div>
            <p>
              Программы лояльности повышают возвращаемость клиентов на 35%. 
              Рекомендуем устанавливать кэшбэк в размере 5-10% и ограничение по оплате в 30-50%.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
