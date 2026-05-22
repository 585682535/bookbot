import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearAllUsers() {
  console.log('⚠️ Удаление всех пользователей и клиентов...');
  
  try {
    // Порядок важен из-за foreign keys
    await prisma.notification.deleteMany({});
    await prisma.bookingAudit.deleteMany({});
    await prisma.promocodeUsage.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.waitlist.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.telegramLinkRequest.deleteMany({});
    await prisma.subscriptionPurchase.deleteMany({});
    await prisma.giftCertificate.deleteMany({});
    
    // Delete clients and users
    await prisma.client.deleteMany({});
    await prisma.user.deleteMany({});
    
    console.log('✅ Все пользователи и клиенты удалены');
    console.log('📝 Бизнесы, услуги и настройки сохранены');
  } catch (error) {
    console.error('❌ Ошибка при очистке базы данных:', error);
  }
}

clearAllUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
