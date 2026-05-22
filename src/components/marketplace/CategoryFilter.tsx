import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  categories: any[];
  selected: string;
  onSelect: (slug: string) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const items = Array.isArray(categories) ? categories : [];
  
  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto px-3 pb-3 scrollbar-hide no-scrollbar"
    >
      {/* Кнопка "Все" */}
      <button
        onClick={() => onSelect('')}
        className={cn(
          "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
          !selected
            ? "bg-blue-600 text-white border-blue-600 shadow-sm"
            : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
        )}
      >
        🌐 Все
      </button>
      
      {items.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.slug)}
          className={cn(
            "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
            selected === cat.slug
              ? "text-white"
              : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
          )}
          style={selected === cat.slug ? { background: cat.color, borderColor: cat.color } : {}}
        >
          <span>{cat.icon}</span>
          <span>{cat.name}</span>
          {cat._count?.businesses > 0 && (
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full ml-1",
              selected === cat.slug ? "bg-white/20" : "bg-gray-100"
            )}>
              {cat._count.businesses}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
