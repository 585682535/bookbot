import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddressAutocompleteProps {
  value: string;
  onChange: (data: { address: string; latitude: number; longitude: number }) => void;
  className?: string;
}

export function AddressAutocomplete({ value, onChange, className }: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const searchAddress = async (address: string) => {
    if (!address || address.length < 4) {
      setSuggestions([]);
      return;
    }
    
    setIsSearching(true);
    setError(null);
    
    try {
      // Use Yandex Geocoder with slightly different parameters to get multiple results if possible
      const rawKey = (process.env as any).YANDEX_MAPS_API_KEY || '';
      const apiKey = rawKey.trim().replace(/^['"]|['"]$/g, '');
      const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${encodeURIComponent(address)}&format=json&results=5`;
      
      const resp = await fetch(url);
      const data = await resp.json();
      
      const featureMembers = data?.response?.GeoObjectCollection?.featureMember || [];
      const results = featureMembers.map((m: any) => {
        const obj = m.GeoObject;
        const [lng, lat] = obj.Point.pos.split(' ').map(Number);
        return {
          address: obj.metaDataProperty.GeocoderMetaData.text,
          latitude: lat,
          longitude: lng
        };
      });

      setSuggestions(results);
      if (results.length > 0) setShowSuggestions(true);
    } catch (e) {
      console.error('Geocoder error:', e);
      setError('Ошибка поиска');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelect = (item: any) => {
    onChange(item);
    setInputValue(item.address);
    setShowSuggestions(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    timeoutRef.current = setTimeout(() => {
      searchAddress(val);
    }, 600);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      handleSelect(suggestions[0]);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="Введите адрес (например: Москва, Тверская 1)"
          className="pl-9 h-11 rounded-xl border-slate-200"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-[100] left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-start gap-3 border-b border-slate-50 last:border-0"
              onClick={() => handleSelect(item)}
            >
              <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-slate-700">{item.address}</span>
            </button>
          ))}
        </div>
      )}
      
      {error && (
        <p className="text-xs text-red-500 mt-1 ml-1">{error}</p>
      )}
    </div>
  );
}
