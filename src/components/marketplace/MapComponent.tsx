import { useEffect, useRef } from 'react';

interface MapComponentProps {
  center: { lat: number; lng: number };
  businesses: any[];
  selectedBusiness: any | null;
  onSelectBusiness: (business: any) => void;
  userLocation: { lat: number; lng: number };
}

export function MapComponent({
  center,
  businesses,
  selectedBusiness,
  onSelectBusiness,
  userLocation
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  
  // Инициализация карты
  useEffect(() => {
    if (!mapRef.current || !window.ymaps3) return;
    
    const initMap = async () => {
      try {
        await window.ymaps3.ready;
        
        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer } = window.ymaps3;
        
        if (mapInstanceRef.current) return;

        const map = new YMap(mapRef.current, {
          location: {
            center: [center.lng, center.lat],
            zoom: 13
          }
        });
        
        map.addChild(new YMapDefaultSchemeLayer());
        map.addChild(new YMapDefaultFeaturesLayer());
        
        mapInstanceRef.current = map;
        
        // Маркер пользователя
        addUserMarker(map, userLocation);
        
        // Маркеры бизнесов
        updateBusinessMarkers(map, businesses);
      } catch (err) {
        console.error("Yandex Maps Init Error:", err);
      }
    };
    
    initMap();
    
    return () => {
      // Logic for cleanup if needed, but in 3.0 destroy is often not enough if re-initing
    };
  }, []);
  
  // Добавить маркер пользователя
  const addUserMarker = (map: any, location: { lat: number; lng: number }) => {
    const { YMapMarker } = window.ymaps3;
    
    const element = document.createElement('div');
    element.innerHTML = `
      <div style="
        width: 24px;
        height: 24px;
        background: #3B82F6;
        border: 4px solid white;
        border-radius: 50%;
        box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div>
      </div>
    `;
    
    const marker = new YMapMarker(
      { coordinates: [location.lng, location.lat] },
      element
    );
    
    map.addChild(marker);
  };
  
  // Обновить маркеры бизнесов
  const updateBusinessMarkers = (map: any, businesses: any[]) => {
    const { YMapMarker } = window.ymaps3;
    
    // Удалить старые маркеры
    markersRef.current.forEach(m => map.removeChild(m));
    markersRef.current = [];
    
    // Добавить новые
    businesses
      .filter(b => b.latitude && b.longitude)
      .forEach(business => {
        const element = document.createElement('div');
        element.style.cursor = 'pointer';
        
        const isSelected = selectedBusiness?.id === business.id;
        const color = business.category?.color || '#3B82F6';
        const icon = business.category?.icon || '📍';
        const priceLabel = business.minPrice ? `от ${business.minPrice}₽` : 'Запись';
        
        element.innerHTML = `
          <div style="
            background: ${isSelected ? '#111827' : 'white'};
            color: ${isSelected ? 'white' : '#111827'};
            padding: 6px 12px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 800;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border: 2px solid ${isSelected ? '#111827' : color};
            transform: ${isSelected ? 'scale(1.1) translateY(-5px)' : 'scale(1)'};
            transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            display: flex;
            align-items: center;
            gap: 6px;
          ">
            <span style="font-size: 14px;">${icon}</span>
            <span>${priceLabel}</span>
          </div>
        `;
        
        element.addEventListener('click', () => onSelectBusiness(business));
        
        const marker = new YMapMarker(
          { coordinates: [business.longitude, business.latitude] },
          element
        );
        
        map.addChild(marker);
        markersRef.current.push(marker);
      });
  };
  
  // Обновить маркеры при изменении бизнесов
  useEffect(() => {
    if (mapInstanceRef.current) {
      updateBusinessMarkers(mapInstanceRef.current, businesses);
    }
  }, [businesses, selectedBusiness]);
  
  // Центрировать на выбранном бизнесе
  useEffect(() => {
    if (selectedBusiness?.latitude && selectedBusiness?.longitude && mapInstanceRef.current) {
      mapInstanceRef.current.update({
        location: {
          center: [selectedBusiness.longitude, selectedBusiness.latitude],
          zoom: 15,
          duration: 500
        }
      });
    }
  }, [selectedBusiness]);
  
  return (
    <div ref={mapRef} className="w-full h-full" />
  );
}
