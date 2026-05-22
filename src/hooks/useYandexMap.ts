import { useEffect, useState } from 'react';

declare global {
  interface Window {
    ymaps3: any;
  }
}

export function useYandexMap() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // If already loaded
    if (window.ymaps3) {
      setIsLoaded(true);
      return;
    }

    // Get and clean the API Key
    let apiKey = (process.env as any).YANDEX_MAPS_API_KEY || (import.meta as any).env?.VITE_YANDEX_MAPS_API_KEY;
    
    // Clean potential quotes or spaces if they were copy-pasted accidentally
    if (apiKey) {
      apiKey = apiKey.trim().replace(/^['"]|['"]$/g, '');
    }

    if (!apiKey || apiKey === 'YOUR_YANDEX_MAPS_API_KEY' || apiKey === 'undefined' || apiKey === '') {
      console.warn("Yandex Maps API Key is not set correctly.");
      setError("API-ключ Яндекс.Карт не настроен. Пожалуйста, добавьте YANDEX_MAPS_API_KEY в Secrets приложения.");
      return;
    }
    
    // Check if script is already injecting
    if (document.querySelector('script[src*="api-maps.yandex.ru"]')) {
      return;
    }

    // Create script element
    const script = document.createElement('script');
    // Using 3.0/ which is the most standard version string for JS API v3
    script.src = `https://api-maps.yandex.ru/3.0/?apikey=${apiKey}&lang=ru_RU`;
    script.type = 'text/javascript';
    script.async = true;
    script.id = 'yandex-maps-api-script';
    
    script.onload = () => {
      console.log("Yandex Maps Script loaded successfully");
      const checkLoaded = setInterval(() => {
        if (window.ymaps3) {
          setIsLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 50);
      
      setTimeout(() => clearInterval(checkLoaded), 15000); // 15s timeout for global population
    };

    script.onerror = () => {
      const errorMsg = "Не удалось загрузить JavaScript API Яндекс.Карт.";
      setError(`${errorMsg} Обычно это означает, что API-ключ недействителен, неактивен (проверьте 'JavaScript API' в кабинете) или домен '${window.location.host}' не добавлен в список разрешенных.`);
      console.error("Yandex Maps Script loading error. tried key:", apiKey?.substring(0, 4) + "****", "domain:", window.location.host);
      
      // Cleanup the failed script tag
      document.getElementById('yandex-maps-api-script')?.remove();
    };

    document.head.appendChild(script);
    
    return () => {
      // Optional cleanup
    };
  }, []);
  
  return { isLoaded, ymaps: window.ymaps3, error };
}
