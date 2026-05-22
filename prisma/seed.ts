import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Create or Update Business Owner
  const owner = await prisma.user.upsert({
    where: { email: '585682535ls@gmail.com' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: '585682535ls@gmail.com',
      password: hashedPassword,
      name: 'Owner',
      role: 'owner',
    }
  });

  // Create Barbershop
  const barbershop = await prisma.business.upsert({
    where: { slug: 'barber-studio' },
    update: {},
    create: {
      name: 'Barber Studio',
      slug: 'barber-studio',
      phone: '+7 900 111 22 33',
      address: 'ул. Пушкина, 10',
      workingHours: {
        mon: { isOpen: true, start: '10:00', end: '20:00' },
        tue: { isOpen: true, start: '10:00', end: '20:00' },
        wed: { isOpen: true, start: '10:00', end: '20:00' },
        thu: { isOpen: true, start: '10:00', end: '20:00' },
        fri: { isOpen: true, start: '10:00', end: '20:00' },
        sat: { isOpen: true, start: '10:00', end: '18:00' },
        sun: { isOpen: false, start: null, end: null }
      },
      slotDuration: 30,
      industry: 'Барбершоп',
      isPublished: true
    }
  });

  await prisma.staff.createMany({
    data: [
      { businessId: barbershop.id, name: 'Иван' },
      { businessId: barbershop.id, name: 'Петр' }
    ]
  });

  await prisma.service.createMany({
    data: [
      { businessId: barbershop.id, name: 'Мужская стрижка', durationMinutes: 30, price: 1500 },
      { businessId: barbershop.id, name: 'Стрижка + Борода', durationMinutes: 60, price: 2500 }
    ]
  });

  // Create Trampoline Center
  const trampoline = await prisma.business.upsert({
    where: { slug: 'trampoline-center' },
    update: {},
    create: {
      name: 'Батутный Центр "Полет"',
      slug: 'trampoline-center',
      phone: '+7 900 444 55 66',
      address: 'пр. Ленина, 50',
      workingHours: {
        mon: { isOpen: true, start: '09:00', end: '22:00' },
        tue: { isOpen: true, start: '09:00', end: '22:00' },
        wed: { isOpen: true, start: '09:00', end: '22:00' },
        thu: { isOpen: true, start: '09:00', end: '22:00' },
        fri: { isOpen: true, start: '09:00', end: '22:00' },
        sat: { isOpen: true, start: '09:00', end: '22:00' },
        sun: { isOpen: true, start: '09:00', end: '22:00' }
      },
      slotDuration: 60
    }
  });

  await prisma.staff.createMany({
    data: [
      { businessId: trampoline.id, name: 'Зал 1' },
      { businessId: trampoline.id, name: 'Зал 2' }
    ]
  });

  await prisma.service.createMany({
    data: [
      { businessId: trampoline.id, name: 'Детская сессия', durationMinutes: 60, price: 800 },
      { businessId: trampoline.id, name: 'Взрослая сессия', durationMinutes: 60, price: 1200 },
      { businessId: trampoline.id, name: 'Групповое занятие', durationMinutes: 90, price: 3000 }
    ]
  });

  // Update owner with businessId
  await prisma.user.update({
    where: { id: owner.id },
    data: { businessId: barbershop.id }
  });

  // Create specific test client user in User table
  await prisma.user.upsert({
    where: { email: 'klient3@gmail.com' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'klient3@gmail.com',
      password: hashedPassword,
      name: 'Test Client',
      role: 'client',
    }
  });

  // Also create a record in the Client table for testing client-specific features
  await prisma.client.upsert({
    where: { phone: '79990003333' },
    update: {
      email: 'klient3@gmail.com',
      password: hashedPassword,
      isRegistered: true
    },
    create: {
      phone: '79990003333',
      name: 'Test Client',
      email: 'klient3@gmail.com',
      password: hashedPassword,
      isRegistered: true
    }
  });

  // Create another reported failing user
  await prisma.user.upsert({
    where: { email: '585682535ls@gmail.com' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: '585682535ls@gmail.com',
      password: hashedPassword,
      name: 'Test Owner',
      role: 'owner',
      businessId: barbershop.id
    }
  });

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
