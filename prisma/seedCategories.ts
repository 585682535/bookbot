import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCategories() {
  const categories = [
    {
      name: 'Барбершопы',
      namePlural: 'Барбершопов',
      slug: 'barbershops',
      icon: '✂️',
      color: '#3B82F6',
      sortOrder: 1
    },
    {
      name: 'Салоны красоты',
      namePlural: 'Салонов красоты',
      slug: 'beauty-salons',
      icon: '💇',
      color: '#EC4899',
      sortOrder: 2
    },
    {
      name: 'Ногтевые студии',
      namePlural: 'Ногтевых студий',
      slug: 'nail-studios',
      icon: '💅',
      color: '#F59E0B',
      sortOrder: 3
    },
    {
      name: 'Массажные салоны',
      namePlural: 'Массажных салонов',
      slug: 'massage',
      icon: '💆',
      color: '#10B981',
      sortOrder: 4
    },
    {
      name: 'Тату-салоны',
      namePlural: 'Тату-салонов',
      slug: 'tattoo',
      icon: '🎨',
      color: '#6B7280',
      sortOrder: 5
    },
    {
      name: 'Фитнес',
      namePlural: 'Фитнес-клубов',
      slug: 'fitness',
      icon: '🏋️',
      color: '#EF4444',
      sortOrder: 6
    },
    {
      name: 'Йога',
      namePlural: 'Йога-студий',
      slug: 'yoga',
      icon: '🧘',
      color: '#8B5CF6',
      sortOrder: 7
    },
    {
      name: 'Медицина',
      namePlural: 'Медицинских центров',
      slug: 'medicine',
      icon: '🏥',
      color: '#06B6D4',
      sortOrder: 8
    },
    {
      name: 'Стоматология',
      namePlural: 'Стоматологий',
      slug: 'dental',
      icon: '🦷',
      color: '#64748B',
      sortOrder: 9
    },
    {
      name: 'Автосервисы',
      namePlural: 'Автосервисов',
      slug: 'auto',
      icon: '🚗',
      color: '#F97316',
      sortOrder: 10
    },
    {
      name: 'Автомойки',
      namePlural: 'Автомоек',
      slug: 'carwash',
      icon: '🚿',
      color: '#0EA5E9',
      sortOrder: 11
    },
    {
      name: 'Детейлинг',
      namePlural: 'Детейлинг-центров',
      slug: 'detailing',
      icon: '✨',
      color: '#A855F7',
      sortOrder: 12
    },
    {
      name: 'Рестораны',
      namePlural: 'Ресторанов',
      slug: 'restaurants',
      icon: '🍽️',
      color: '#D97706',
      sortOrder: 13
    },
    {
      name: 'Бани и SPA',
      namePlural: 'Бань и SPA',
      slug: 'spa-sauna',
      icon: '🧖',
      color: '#BE185D',
      sortOrder: 14
    },
    {
      name: 'Квесты',
      namePlural: 'Квест-комнат',
      slug: 'quests',
      icon: '🔐',
      color: '#7C3AED',
      sortOrder: 15
    },
    {
      name: 'Батутные центры',
      namePlural: 'Батутных центров',
      slug: 'trampoline',
      icon: '🤸',
      color: '#059669',
      sortOrder: 16
    },
    {
      name: 'Обучение',
      namePlural: 'Учебных центров',
      slug: 'education',
      icon: '📚',
      color: '#1D4ED8',
      sortOrder: 17
    },
    {
      name: 'Ветеринария',
      namePlural: 'Ветеринарных клиник',
      slug: 'veterinary',
      icon: '🐾',
      color: '#15803D',
      sortOrder: 18
    },
    {
      name: 'Аренда',
      namePlural: 'Арендных площадок',
      slug: 'rental',
      icon: '🏢',
      color: '#92400E',
      sortOrder: 19
    },
    {
      name: 'Фотографы',
      namePlural: 'Фотографов',
      slug: 'photography',
      icon: '📸',
      color: '#1E293B',
      sortOrder: 20
    }
  ];
  
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat
    });
  }
  
  console.log('✅ Категории созданы');
}

seedCategories()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
