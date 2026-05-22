import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Building2, MapPin, Users, Briefcase, CheckCircle2, ArrowRight, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';

const industries = [
  { id: 'beauty', name: 'Красота и здоровье', subcategories: ['Салон красоты', 'Барбершоп', 'Маникюр', 'Косметология', 'SPA'] },
  { id: 'medical', name: 'Медицина', subcategories: ['Стоматология', 'Клиника', 'Анализы', 'Ветеринария'] },
  { id: 'sport', name: 'Спорт', subcategories: ['Фитнес-клуб', 'Йога', 'Персональные тренировки', 'Танцы'] },
  { id: 'auto', name: 'Авто', subcategories: ['Автосервис', 'Мойка', 'Шиномонтаж'] },
  { id: 'other', name: 'Другое', subcategories: ['Образование', 'Юристы', 'Фотостудия', 'Аренда'] },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    logo: '',
    address: '',
    city: '',
    postalCode: '',
    timezone: 'Europe/Moscow',
    currency: 'RUB',
    industry: '',
    subcategory: '',
    employeeCount: '',
    locationCount: '',
    role: '',
  });

  React.useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const token = localStorage.getItem('ownerToken');
        const res = await axios.get('/api/businesses/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.data) {
          // Если бизнес уже опубликован и данные заполнены, перенаправляем в дашборд
          if (res.data.isPublished && res.data.name && res.data.address && res.data.industry) {
            navigate(`/dashboard/${res.data.slug}`);
            return;
          }

          setFormData({
            companyName: res.data.name || '',
            logo: res.data.logo || '',
            address: res.data.address || '',
            city: res.data.city || '',
            postalCode: res.data.postalCode || '',
            timezone: res.data.timezone || 'Europe/Moscow',
            currency: res.data.currency || 'RUB',
            industry: res.data.industry || '',
            subcategory: res.data.subcategory || '',
            employeeCount: res.data.employeeCount || '',
            locationCount: res.data.locationCount || '',
            role: res.data.ownerRole || '',
          });
        }
      } catch (error) {
        console.error('Error fetching business data:', error);
      }
    };
    fetchBusiness();
  }, []);

  const totalSteps = 3;
  const progress = (step / totalSteps) * 100;

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
    else handleSubmit();
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ownerToken');
      const res = await axios.post('/api/businesses/onboarding', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Настройка завершена!');
      navigate(`/dashboard/${res.data.slug}`);
    } catch (error) {
      toast.error('Ошибка при сохранении данных');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Настройка вашего бизнеса</h1>
          <p className="text-slate-500">Давайте подготовим вашу платформу к работе за пару минут</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold uppercase text-slate-400">
            <span>Шаг {step} из {totalSteps}</span>
            <span>{Math.round(progress)}% завершено</span>
          </div>
          <Progress value={progress} className="h-2 bg-slate-200" />
        </div>

        <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
          <CardContent className="p-8">
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Информация о компании</h2>
                    <p className="text-sm text-slate-500">Базовые данные вашего бизнеса</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Название компании</Label>
                    <Input 
                      placeholder="Например: Студия Блеск" 
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ссылка на логотип (URL)</Label>
                    <Input 
                      placeholder="https://example.com/logo.png" 
                      value={formData.logo}
                      onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Адрес</Label>
                    <Input 
                      placeholder="ул. Пушкина, д. 10" 
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Город</Label>
                    <Input 
                      placeholder="Москва" 
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Почтовый индекс</Label>
                    <Input 
                      placeholder="123456" 
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Часовой пояс</Label>
                    <Select value={formData.timezone} onValueChange={(v) => setFormData({ ...formData, timezone: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Europe/Moscow">Москва (GMT+3)</SelectItem>
                        <SelectItem value="Europe/Kaliningrad">Калининград (GMT+2)</SelectItem>
                        <SelectItem value="Asia/Yekaterinburg">Екатеринбург (GMT+5)</SelectItem>
                        <SelectItem value="Asia/Novosibirsk">Новосибирск (GMT+7)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Валюта</Label>
                    <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RUB">Российский рубль (₽)</SelectItem>
                        <SelectItem value="USD">Доллар США ($)</SelectItem>
                        <SelectItem value="EUR">Евро (€)</SelectItem>
                        <SelectItem value="KZT">Тенге (₸)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Сфера деятельности</h2>
                    <p className="text-sm text-slate-500">Поможет нам настроить шаблоны под вас</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>Основная индустрия</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {industries.map((ind) => (
                      <button
                        key={ind.id}
                        onClick={() => setFormData({ ...formData, industry: ind.id, subcategory: '' })}
                        className={`p-4 rounded-2xl border-2 text-left transition-all ${
                          formData.industry === ind.id 
                            ? 'border-blue-600 bg-blue-50 text-blue-700' 
                            : 'border-slate-100 hover:border-slate-200 text-slate-600'
                        }`}
                      >
                        <p className="font-bold text-sm">{ind.name}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {formData.industry && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <Label>Подкатегория</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {industries.find(i => i.id === formData.industry)?.subcategories.map((sub) => (
                        <button
                          key={sub}
                          onClick={() => setFormData({ ...formData, subcategory: sub })}
                          className={`p-3 rounded-xl border text-left text-xs transition-all ${
                            formData.subcategory === sub 
                              ? 'bg-slate-900 text-white border-slate-900' 
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">О вашем бизнесе</h2>
                    <p className="text-sm text-slate-500">Последние штрихи перед запуском</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label>Количество сотрудников</Label>
                    <div className="grid grid-cols-4 gap-3">
                      {['1', '2-5', '6-20', '20+'].map((count) => (
                        <button
                          key={count}
                          onClick={() => setFormData({ ...formData, employeeCount: count })}
                          className={`p-3 rounded-xl border text-sm transition-all ${
                            formData.employeeCount === count 
                              ? 'bg-blue-600 text-white border-blue-600' 
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                          }`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Количество филиалов</Label>
                    <div className="grid grid-cols-4 gap-3">
                      {['1', '2-3', '4-10', '10+'].map((count) => (
                        <button
                          key={count}
                          onClick={() => setFormData({ ...formData, locationCount: count })}
                          className={`p-3 rounded-xl border text-sm transition-all ${
                            formData.locationCount === count 
                              ? 'bg-blue-600 text-white border-blue-600' 
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                          }`}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Ваша роль</Label>
                    <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите роль" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Владелец / Директор</SelectItem>
                        <SelectItem value="manager">Управляющий</SelectItem>
                        <SelectItem value="admin">Администратор</SelectItem>
                        <SelectItem value="master">Мастер / Специалист</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-12">
              {step > 1 && (
                <Button 
                  variant="outline" 
                  className="flex-1 h-12 rounded-2xl"
                  onClick={handleBack}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Назад
                </Button>
              )}
              <Button 
                className="flex-[2] h-12 rounded-2xl bg-blue-600 hover:bg-blue-700"
                onClick={handleNext}
                disabled={loading}
              >
                {loading ? 'Сохранение...' : (step === totalSteps ? 'Завершить настройку' : 'Продолжить')}
                {step < totalSteps && <ArrowRight className="w-4 h-4 ml-2" />}
                {step === totalSteps && <CheckCircle2 className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
