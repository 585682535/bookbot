import { Star, MapPin, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BusinessCardProps {
  business: any;
  compact?: boolean;
  onClick: () => void;
  onBook: () => void;
}

export function BusinessCard({ business, compact, onClick, onBook }: BusinessCardProps) {
  if (compact) {
    return (
      <Card
        className="p-3 cursor-pointer hover:shadow-md transition-shadow bg-white border-none shadow-sm"
        onClick={onClick}
      >
        <div className="flex items-start gap-3">
          {business.logo ? (
            <img
              src={business.logo}
              alt={business.name}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
              style={{ background: (business.category?.color || '#3B82F6') + '20' }}
            >
              {business.category?.icon || '🏪'}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate text-sm">{business.name}</h3>
            
            {business.avgRating && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="text-[11px] font-medium">{business.avgRating}</span>
                <span className="text-[11px] text-gray-400">({business.reviewCount})</span>
              </div>
            )}
            
            <p className="text-[11px] text-green-600 font-bold mt-1">
              от {business.minPrice} ₽
            </p>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <Card
      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer border-none shadow-sm"
      onClick={onClick}
    >
      {/* Обложка */}
      {business.coverImage && (
        <div className="h-40 overflow-hidden">
          <img
            src={business.coverImage}
            alt={business.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      )}
      
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Лого */}
          {business.logo ? (
            <img
              src={business.logo}
              alt={business.name}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: (business.category?.color || '#3B82F6') + '20' }}
            >
              {business.category?.icon || '🏪'}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div>
                {business.isFeatured && (
                  <Badge variant="secondary" className="mb-1 text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200">
                    ⭐ Топ
                  </Badge>
                )}
                
                <h3 className="font-bold text-lg leading-tight truncate">{business.name}</h3>
                
                {business.category && (
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full inline-block mt-1"
                    style={{
                      background: (business.category?.color || '#3B82F6') + '20',
                      color: business.category?.color || '#3B82F6'
                    }}
                  >
                    {business.category?.icon} {business.category?.name}
                  </span>
                )}
              </div>
              
              {business.avgRating && (
                <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg flex-shrink-0">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  <span className="font-bold text-sm">{business.avgRating}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4 mt-2">
              {business.distance !== null && (
                <div className="flex items-center gap-1 text-gray-500 text-xs text-nowrap">
                  <MapPin className="w-3 h-3" />
                  <span>{business.distance} км</span>
                </div>
              )}
              
              <div className="flex items-center gap-1 text-xs">
                <Clock className="w-3 h-3" />
                <span className={business.isOpenNow ? 'text-green-600' : 'text-red-500'}>
                  {business.isOpenNow ? 'Открыто' : 'Закрыто'}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Адрес */}
        {business.address && (
          <p className="text-sm text-gray-500 mt-3 flex items-start gap-1">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-1">{business.address}</span>
          </p>
        )}
        
        {/* Услуги */}
        {business.services.length > 0 && (
          <div className="mt-3">
            <div className="flex gap-2 flex-wrap">
              {business.services.slice(0, 3).map((service: any) => (
                <Badge key={service.id} variant="outline" className="text-[10px] font-normal text-gray-500 border-gray-100">
                  {service.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Кнопки */}
        <div className="flex items-center justify-between mt-4">
          <div>
            {business.minPrice && (
              <p className="text-green-600 font-bold text-lg">
                от {business.minPrice} ₽
              </p>
            )}
            <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Оплата на месте</p>
          </div>
          
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onBook();
            }}
            className="rounded-xl h-10 px-6 bg-blue-600 hover:bg-blue-700 font-bold"
          >
            Записаться
          </Button>
        </div>
      </div>
    </Card>
  );
}
