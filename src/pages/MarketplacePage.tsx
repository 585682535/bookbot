import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, List, Map, SlidersHorizontal, X, AlertCircle, ArrowLeft, User as UserIcon, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { BusinessCard } from '@/components/marketplace/BusinessCard';
import { MapComponent } from '@/components/marketplace/MapComponent';
import { CategoryFilter } from '@/components/marketplace/CategoryFilter';
import { BusinessDrawer } from '@/components/marketplace/BusinessDrawer';
import { GlobalSocialFeed } from '@/components/marketplace/GlobalSocialFeed';
import { useYandexMap } from '@/hooks/useYandexMap';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Filters {
  categorySlug: string;
  minRating: string;
  maxPrice: string;
  radius: string;
  sortBy: string;
  query: string;
}

interface Business {
  id: string;
  name: string;
  slug: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  logo: string | null;
  coverImage: string | null;
  category: { name: string; icon: string; color: string } | null;
  services: { id: string; name: string; price: number; durationMinutes: number }[];
  avgRating: number | null;
  reviewCount: number;
  minPrice: number | null;
  distance: number | null;
  isOpenNow: boolean;
  isFeatured: boolean;
  description: string | null;
  phone: string | null;
}

export function MarketplacePage() {
  const navigate = useNavigate();
  const { isLoaded, error: mapError } = useYandexMap();
  const [view, setView] = useState<'map' | 'list' | 'feed'>('map');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    categorySlug: '',
    minRating: '',
    maxPrice: '',
    radius: '10000',
    sortBy: 'distance',
    query: ''
  });
  
  // Получить геолокацию пользователя
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
      },
      () => {
        // Москва по умолчанию
        setUserLocation({ lat: 55.7558, lng: 37.6173 });
      }
    );
  }, []);
  
  // Загрузить категории
  const { data: categories } = useQuery({
    queryKey: ['marketplace-categories'],
    queryFn: () => fetch('/api/marketplace/categories').then(r => r.json())
  });
  
  // Загрузить бизнесы
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['marketplace-businesses', userLocation, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (userLocation) {
        params.set('lat', userLocation.lat.toString());
        params.set('lng', userLocation.lng.toString());
      }
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      
      const response = await fetch(`/api/marketplace/businesses?${params}`);
      return response.json();
    },
    // We want to load businesses even if location is not yet available
    // but we can refetch when it is
    enabled: true 
  });
  
  const businesses: Business[] = data?.businesses || [];
  const hasClientToken = !!localStorage.getItem('clientToken');
  
  // Сбросить фильтры
  const resetFilters = () => {
    setFilters({
      categorySlug: '',
      minRating: '',
      maxPrice: '',
      radius: '10000',
      sortBy: 'distance',
      query: ''
    });
  };
  
  const activeFiltersCount = [
    filters.categorySlug,
    filters.minRating,
    filters.maxPrice,
    filters.radius !== '10' ? filters.radius : ''
  ].filter(Boolean).length;
  
  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden text-slate-900">
      
      {/* ХЕДЕР */}
      <header className="bg-white border-b z-20 shrink-0">
        <div className="flex items-center gap-2 p-3 max-w-7xl mx-auto">
          
          {/* Кнопка назад */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)} 
            className="rounded-xl hover:bg-slate-50 transition-colors shrink-0 h-10 w-10"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Button>

          {/* Логотип */}
          <button onClick={() => navigate('/')} className="font-black text-blue-600 text-xl tracking-tighter hidden lg:block mr-2">
            BOOKBOT
          </button>
          
          {/* Поиск */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9 pr-4 rounded-xl border-slate-100 bg-slate-50 focus-visible:ring-blue-600 focus-visible:bg-white transition-all h-10"
              placeholder="Барбершоп, массаж..."
              value={filters.query}
              onChange={(e) => setFilters(f => ({ ...f, query: e.target.value }))}
            />
          </div>
          
          {/* Кнопка фильтров */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
                "relative rounded-xl border-slate-100 shrink-0 h-10 w-10",
                showFilters && "bg-slate-50 border-slate-200"
            )}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          
          {/* Переключатель вида (десктоп) */}
          <div className="hidden md:flex border border-slate-100 rounded-xl overflow-hidden shrink-0">
            <button
              className={cn(
                "p-2.5 transition-colors",
                view === 'map' ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              )}
              onClick={() => setView('map')}
            >
              <Map className="w-4 h-4" />
            </button>
            <button
              className={cn(
                "p-2.5 transition-colors",
                view === 'list' ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              )}
              onClick={() => setView('list')}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              className={cn(
                "p-2.5 transition-colors border-l border-slate-100",
                view === 'feed' ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              )}
              onClick={() => setView('feed')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          {hasClientToken && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/profile')}
              className="rounded-xl border-blue-100 text-blue-600 hover:bg-blue-50 shrink-0 h-10 w-10"
            >
              <UserIcon className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Переключатель вида (мобильные под-меню табы) */}
        <div className="md:hidden flex border-t border-slate-100 bg-slate-50/50 p-2 justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-xl flex-1 text-xs font-bold gap-1.5 h-9 transition-all", 
              view === 'map' ? "bg-blue-600 text-white shadow-sm shadow-blue-100 hover:bg-blue-600 hover:text-white" : "text-slate-600 hover:bg-slate-100"
            )}
            onClick={() => setView('map')}
          >
            <Map className="w-3.5 h-3.5" /> Карта
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-xl flex-1 text-xs font-bold gap-1.5 h-9 transition-all", 
              view === 'list' ? "bg-blue-600 text-white shadow-sm shadow-blue-100 hover:bg-blue-600 hover:text-white" : "text-slate-600 hover:bg-slate-100"
            )}
            onClick={() => setView('list')}
          >
            <List className="w-3.5 h-3.5" /> Список
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "rounded-xl flex-1 text-xs font-bold gap-1.5 h-9 transition-all", 
              view === 'feed' ? "bg-blue-600 text-white shadow-sm shadow-blue-100 hover:bg-blue-600 hover:text-white" : "text-slate-600 hover:bg-slate-100"
            )}
            onClick={() => setView('feed')}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Лента
          </Button>
        </div>
        
        {/* Категории */}
        <div className="max-w-7xl mx-auto">
            <CategoryFilter
            categories={categories || []}
            selected={filters.categorySlug}
            onSelect={(slug) => setFilters(f => ({
                ...f,
                categorySlug: f.categorySlug === slug ? '' : slug
            }))}
            />
        </div>
        
        {/* Фильтры */}
        {showFilters && (
          <div className="border-t p-3 bg-slate-50/50 overflow-x-auto">
            <div className="flex gap-3 max-w-7xl mx-auto">
              <Select
                value={filters.radius}
                onValueChange={(v) => setFilters(f => ({ ...f, radius: v }))}
              >
                <SelectTrigger className="w-32 bg-white rounded-xl h-9 text-xs border-slate-100">
                  <SelectValue placeholder="Радиус" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="1">до 1 км</SelectItem>
                  <SelectItem value="3">до 3 км</SelectItem>
                  <SelectItem value="5">до 5 км</SelectItem>
                  <SelectItem value="10">до 10 км</SelectItem>
                  <SelectItem value="25">до 25 км</SelectItem>
                  <SelectItem value="50">до 50 км</SelectItem>
                  <SelectItem value="100">до 100 км</SelectItem>
                  <SelectItem value="500">до 500 км</SelectItem>
                  <SelectItem value="10000">Весь мир</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.minRating}
                onValueChange={(v) => setFilters(f => ({ ...f, minRating: v }))}
              >
                <SelectTrigger className="w-36 bg-white rounded-xl h-9 text-xs border-slate-100">
                  <SelectValue placeholder="Рейтинг" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="">Все</SelectItem>
                  <SelectItem value="4">⭐ от 4.0</SelectItem>
                  <SelectItem value="4.5">⭐ от 4.5</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.maxPrice}
                onValueChange={(v) => setFilters(f => ({ ...f, maxPrice: v }))}
              >
                <SelectTrigger className="w-36 bg-white rounded-xl h-9 text-xs border-slate-100">
                  <SelectValue placeholder="Цена" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="">Все цены</SelectItem>
                  <SelectItem value="1000">до 1 000 ₽</SelectItem>
                  <SelectItem value="2000">до 2 000 ₽</SelectItem>
                  <SelectItem value="5000">до 5 000 ₽</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.sortBy}
                onValueChange={(v) => setFilters(f => ({ ...f, sortBy: v }))}
              >
                <SelectTrigger className="w-40 bg-white rounded-xl h-9 text-xs border-slate-100">
                  <SelectValue placeholder="Сортировка" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="distance">Ближайшие</SelectItem>
                  <SelectItem value="rating">По рейтингу</SelectItem>
                  <SelectItem value="price">По цене</SelectItem>
                </SelectContent>
              </Select>
              
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs h-9 text-slate-500 hover:text-blue-600">
                  <X className="w-3 h-3 mr-1" />
                  Сбросить
                </Button>
              )}
            </div>
          </div>
        )}
      </header>
      
      {/* ОСНОВНОЙ КОНТЕНТ */}
      <main className="flex-1 flex overflow-hidden relative">
        
        {/* КАРТА */}
        {view === 'map' && userLocation && (
          <div className="flex flex-1 overflow-hidden relative">
            {mapError ? (
               <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
                 <Alert variant="destructive" className="max-w-md bg-white border-red-100 shadow-xl rounded-3xl">
                   <AlertCircle className="h-5 w-5" />
                   <AlertTitle className="font-black">Ошибка Яндекс.Карт</AlertTitle>
                   <AlertDescription className="mt-2 space-y-4">
                     <p className="text-sm">{mapError}</p>
                     <div className="p-3 bg-red-50 rounded-xl text-[10px] font-mono break-all text-red-700">
                        {window.location.host}
                     </div>
                     <p className="text-xs text-slate-500 italic">
                        Совет: проверьте настройки API-ключа в консоли разработчика Яндекс и убедитесь, что домен разрешен.
                     </p>
                     <div className="flex gap-2">
                         <Button 
                            variant="default" 
                            size="sm" 
                            className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold"
                            onClick={() => window.location.reload()}
                         >
                            Перезагрузить
                         </Button>
                         <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
                            onClick={() => setView('list')}
                         >
                            К списку
                         </Button>
                     </div>
                   </AlertDescription>
                 </Alert>
               </div>
            ) : !isLoaded ? (
               <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 gap-4">
                  <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Загрузка карт...</p>
               </div>
            ) : (
              <div className="flex-1 relative">
                <MapComponent
                  center={userLocation}
                  businesses={businesses}
                  selectedBusiness={selectedBusiness}
                  onSelectBusiness={setSelectedBusiness}
                  userLocation={userLocation}
                />
                
                {/* Счётчик результатов */}
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-2xl shadow-blue-900/10 border border-slate-100 text-xs font-bold pointer-events-none">
                  {isLoading ? (
                    <span className="text-slate-400">ПОИСК...</span>
                  ) : (
                    <span className="text-blue-600 uppercase tracking-wider">{data?.total || 0} заведений</span>
                  )}
                </div>
                
                {/* Loading indicator */}
                {isFetching && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white rounded-full px-5 py-1.5 shadow-lg text-[10px] font-black uppercase tracking-widest z-10">
                    Обновляем...
                  </div>
                )}
  
                {/* Mobile Swipe-up (simplified) */}
                {!selectedBusiness && businesses.length > 0 && (
                  <div className="absolute bottom-6 left-0 right-0 z-10">
                      <div className="flex gap-3 px-4 pb-2 overflow-x-auto no-scrollbar mask-gradient-x">
                          {businesses.map(business => (
                              <div key={business.id} className="w-72 shrink-0">
                                  <BusinessCard
                                      business={business}
                                      compact
                                      onClick={() => setSelectedBusiness(business)}
                                      onBook={() => navigate(`/book/${business.slug}`)}
                                  />
                              </div>
                          ))}
                      </div>
                  </div>
                )}
              </div>
            )}
            
            {/* БОКОВАЯ ПАНЕЛЬ (для десктопа) */}
            {selectedBusiness && (
              <div className="hidden md:block w-[400px] border-l bg-white shrink-0 shadow-2xl z-30">
                <BusinessDrawer
                  business={selectedBusiness}
                  onClose={() => setSelectedBusiness(null)}
                  onBook={() => navigate(`/book/${selectedBusiness.slug}`)}
                />
              </div>
            )}

            {/* Мобильная панель (overlay) */}
            {selectedBusiness && (
               <div className="fixed inset-0 z-[100] md:hidden">
                    <div 
                        className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" 
                        onClick={() => setSelectedBusiness(null)}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] h-[85vh] overflow-hidden animate-in slide-in-from-bottom duration-300">
                        <BusinessDrawer
                            business={selectedBusiness}
                            onClose={() => setSelectedBusiness(null)}
                            onBook={() => navigate(`/book/${selectedBusiness.slug}`)}
                        />
                    </div>
               </div>
            )}
          </div>
        )}
        
        {/* СПИСОК */}
        {view === 'list' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
            <div className="max-w-4xl mx-auto">
              
              {/* Скелетон загрузки */}
              {isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Skeleton key={i} className="h-64 rounded-2xl" />
                  ))}
                </div>
              )}
              
              {/* Пустой результат */}
              {!isLoading && businesses.length === 0 && (
                <div className="text-center py-20 bg-white rounded-[32px] border border-slate-100 shadow-sm">
                  <div className="text-6xl mb-6">🏜️</div>
                  <h3 className="text-2xl font-black mb-2 tracking-tight">Ничего не найдено</h3>
                  <p className="text-slate-500 mb-8 max-w-xs mx-auto">
                    В этой области пока нет подходящих заведений. Попробуйте сбросить фильтры.
                  </p>
                  <Button onClick={resetFilters} variant="secondary" className="rounded-2xl px-8">
                    Сбросить фильтры
                  </Button>
                </div>
              )}
              
              {/* Список бизнесов */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
                {businesses.map(business => (
                  <BusinessCard
                    key={business.id}
                    business={business}
                    onClick={() => {
                      setSelectedBusiness(business);
                      setView('map');
                    }}
                    onBook={() => navigate(`/book/${business.slug}`)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* КЛЕН ЛЕНТА */}
        {view === 'feed' && (
          <div className="flex-1 overflow-y-auto bg-slate-50/30">
             <div className="max-w-xl mx-auto py-8 px-4">
                <GlobalSocialFeed 
                   city={data?.city} 
                   category={filters.categorySlug} 
                />
             </div>
          </div>
        )}
      </main>
    </div>
  );
}
