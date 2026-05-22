import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { createClient } from "redis";
import { addMinutes, subMinutes, format, parse, startOfDay, endOfDay, eachMinuteOfInterval, isWithinInterval, isAfter, isBefore, addDays, addWeeks, addMonths } from "date-fns";
import { ru } from "date-fns/locale";
import axios from "axios";
import * as YooKassa from '@yookassa/sdk';
import { createEvent } from 'ics';
import passport from 'passport';
import session from 'express-session';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import { subDays, addHours } from "date-fns";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const prisma = new PrismaClient();

// Configure SQLite TRUNCATE mode and transaction locking timeouts to prevent locks and corruptions
prisma.$executeRawUnsafe('PRAGMA journal_mode=TRUNCATE;')
  .then(() => prisma.$executeRawUnsafe('PRAGMA busy_timeout=10000;'))
  .then(() => console.log('SQLite configured with TRUNCATE mode and 10000ms busy timeout successfully.'))
  .catch((err) => console.error('Failed to configure SQLite pragmas:', err));
const REDIS_URL = process.env.REDIS_URL;

const normalizePhone = (phone: string | null | undefined) => {
  if (!phone) return "";
  // Strip everything but digits
  let digits = phone.replace(/\D/g, '');
  
  // Russian specific normalization
  if (digits.length === 11) {
    if (digits.startsWith('8')) {
      digits = '7' + digits.slice(1);
    }
  } else if (digits.length === 10) {
    // Assume Russian number if 10 digits
    digits = '7' + digits;
  }
  
  return digits || "";
};
let useRedis = false;
const redis = REDIS_URL ? createClient({ 
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      // Limit retries to avoid constant noise if Redis is down
      if (retries > 3) {
        console.warn("Redis reconnection failed repeatedly. Falling back to in-memory locks.");
        useRedis = false;
        return false; // Stop reconnecting
      }
      return Math.min(retries * 100, 2000);
    }
  }
}) : null;

const memoryLocks = new Map<string, number>();

if (redis) {
  redis.on("error", (err) => {
    // Only log actual socket errors if Redis was previously working
    if (useRedis) {
      console.warn("Redis Client Error:", err.message);
    }
    useRedis = false;
  });

  redis.on("connect", () => {
    console.log("Redis Client Connected");
    useRedis = true;
  });
}

async function startServer() {
  console.log("Starting server initialization...");
  
  // Non-blocking redis connection if configured
  if (redis) {
    redis.connect().catch((err) => {
      // Swallow initial connection error as we have event listeners and fallback
      useRedis = false;
    });
  } else {
    console.log("Redis not configured (REDIS_URL missing). Using in-memory locks.");
  }

  try {
    console.log("Checking Prisma connection...");
    const prismaConnectPromise = prisma.$connect();
    const prismaTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Prisma connection timeout")), 5000)
    );
    await Promise.race([prismaConnectPromise, prismaTimeoutPromise]);
    console.log("Prisma connected successfully");
  } catch (err: any) {
    console.warn("Prisma connection check issue:", err.message);
  }

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.use(session({
    secret: process.env.SESSION_SECRET || 'bookbot-secret',
    resave: false,
    saveUninitialized: false
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  // --- Multer Config for Posts ---
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = './uploads/posts';
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });
  const upload = multer({ 
    storage, 
    limits: { fileSize: 50 * 1024 * 1024 } 
  });

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({ where: { id } });
      done(null, user);
    } catch (e) {
      done(e);
    }
  });

  const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret';
  const generateJWT = (user: any) => jwt.sign({ 
    id: user.id, 
    email: user.email || user.phone, 
    role: user.role || (user.phone ? 'client' : 'owner') 
  }, JWT_SECRET, { expiresIn: '7d' });

  const authenticateJWT = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.split(' ')[1] && authHeader.split(' ')[1] !== 'null' && authHeader.split(' ')[1] !== 'undefined') {
      const token = authHeader.split(' ')[1];
      jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
          console.log('JWT Verification failed:', err.message);
          return res.sendStatus(403);
        }
        console.log('JWT Verified. User from token:', { id: user.id, email: user.email, role: user.role });
        req.user = user;
        next();
      });
    } else {
      console.log('No Authorization header found');
      res.sendStatus(401);
    }
  };

  // Telegram Bot
  let bot: TelegramBot | null = null;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  async function initBot(token: string) {
    if (!token) return;
    try {
      if (bot) {
        console.log("Stopping existing bot...");
        await bot.stopPolling();
      }
      bot = new TelegramBot(token, { polling: true });

      // Handle polling errors, specifically the 409 Conflict which is common during dev restarts
      bot.on('polling_error', (error: any) => {
        if (error.code === 'ETELEGRAM' && error.message.includes('409 Conflict')) {
          // Ignore 409 conflicts as they usually resolve themselves when the new instance takes over
          return;
        }
        console.error("Telegram Polling Error:", error.message);
      });
      
      bot.onText(/\/start (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const linkCode = match?.[1];
        if (linkCode) {
          const linkRequest = await prisma.telegramLinkRequest.findUnique({ where: { code: linkCode } });
          if (linkRequest && !linkRequest.used && linkRequest.expiresAt > new Date()) {
            await prisma.client.update({
              where: { id: linkRequest.clientId },
              data: { telegramChatId: chatId.toString(), telegramUsername: msg.from?.username, notificationMethod: 'telegram' }
            });
            await prisma.telegramLinkRequest.update({ where: { id: linkRequest.id }, data: { used: true } });
            bot?.sendMessage(chatId, '✅ Telegram успешно привязан!\n\nТеперь вы будете получать напоминания о записях сюда.\nSMS-уведомления отключены.');
          } else {
            bot?.sendMessage(chatId, '❌ Неверная или устаревшая ссылка.');
          }
        }
      });
      console.log("Telegram Bot initialized successfully");
    } catch (e) {
      console.error("Failed to initialize Telegram Bot:", e);
    }
  }

  // Initial bot setup
  if (botToken) {
    console.log("Central Telegram Bot Token found, initializing...");
    initBot(botToken);
  } else {
    console.warn("TELEGRAM_BOT_TOKEN not found in environment. Telegram notifications will be disabled.");
  }

  async function sendTelegramNotification(chatId: string, message: string) {
    if (!bot) return false;
    try {
      await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
      return true;
    } catch (e) {
      console.error("Telegram error:", e);
      return false;
    }
  }

  async function sendNotification(client: any, message: string) {
    const results = [];
    if (client.notificationMethod === 'telegram' || client.notificationMethod === 'both') {
      if (client.telegramChatId) {
        const sent = await sendTelegramNotification(client.telegramChatId, message);
        results.push({ channel: 'telegram', success: sent });
      }
    }
    // Mock SMS for now or use existing sendSMS if available
    console.log(`[SMS to ${client.phone}]: ${message}`);
    results.push({ channel: 'sms', success: true });
    return results;
  }

  function generateRandomCode(length: number) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Use the global normalizePhone
  
  // Helper for locking
  const isLocked = async (key: string) => {
    if (useRedis && redis) {
      try {
        const val = await redis.get(key);
        return !!val;
      } catch (e) {
        useRedis = false;
        return false;
      }
    }
    const expiry = memoryLocks.get(key);
    if (expiry && expiry > Date.now()) return true;
    if (expiry) memoryLocks.delete(key); // Clean up expired
    return false;
  };

  const setLock = async (key: string, ttlSeconds: number) => {
    if (useRedis && redis) {
      try {
        const result = await redis.set(key, "locked", { EX: ttlSeconds, NX: true });
        return !!result;
      } catch (e) {
        useRedis = false;
        return false;
      }
    }
    if (await isLocked(key)) return false;
    memoryLocks.set(key, Date.now() + (ttlSeconds * 1000));
    return true;
  };

  const deleteLock = async (key: string) => {
    if (useRedis && redis) {
      try {
        await redis.del(key);
      } catch (e) {
        useRedis = false;
      }
    } else {
      memoryLocks.delete(key);
    }
  };

  // Helper for audit logging
  async function logBookingChange(
    bookingId: string, 
    action: string, 
    oldData: any = null, 
    newData: any = null,
    actor: string = 'system'
  ) {
    try {
      await prisma.bookingAudit.create({
        data: {
          bookingId,
          action,
          oldData,
          newData,
          actor
        }
      });
    } catch (e) {
      console.error("Audit log error:", e);
    }
  }

  // --- Helper Functions ---

  async function getAvailableSlots(businessId: string, serviceId: string, staffId: string | null, date: string) {
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) return [];

    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) return [];

    const dayOfWeek = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][parse(date, "yyyy-MM-dd", new Date()).getDay()];
    const workingHours = (business.workingHours as any)[dayOfWeek];

    if (!workingHours || !workingHours.start || !workingHours.end) {
      return [];
    }

    const start = parse(`${date} ${workingHours.start}`, "yyyy-MM-dd HH:mm", new Date());
    const end = parse(`${date} ${workingHours.end}`, "yyyy-MM-dd HH:mm", new Date());

    const bookings = await prisma.booking.findMany({
      where: {
        businessId: business.id,
        startTime: { gte: startOfDay(new Date(date)), lte: endOfDay(new Date(date)) },
        status: { not: "CANCELLED" },
        ...(staffId ? { staffId: staffId } : {})
      }
    });

    const totalStaff = staffId && staffId !== 'undefined'
      ? await prisma.staff.count({ where: { id: staffId, businessId: business.id, isActive: true } })
      : await prisma.staff.count({ where: { businessId: business.id, isActive: true } });

    const slots: any[] = [];
    let current = start;

    const slotLimit = subMinutes(end, service.durationMinutes);

    while (!isAfter(current, slotLimit)) {
      const slotEnd = addMinutes(current, service.durationMinutes);
      let isAvailable = false;
      let availableCount = 0;

      if (service.isGroupService) {
        const participants = bookings.filter(b => 
          b.serviceId === service.id && 
          format(b.startTime, "HH:mm") === format(current, "HH:mm")
        ).length;
        availableCount = (service.maxParticipants || 1) - participants;
        isAvailable = availableCount > 0;
      } else {
        const bookedCount = bookings.filter(b => {
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          // Standard overlap check: (StartA < EndB) and (EndA > StartB)
          return current < bEnd && slotEnd > bStart;
        }).length;
        availableCount = totalStaff - bookedCount;
        isAvailable = availableCount > 0;
      }

      const lockKey = `lock:${business.id}:${staffId || 'any'}:${format(current, "yyyy-MM-dd-HH-mm")}`;
      const locked = await isLocked(lockKey);

      if (isAvailable && !locked) {
        let price = service.price;
        let priceLabel = "";
        if (service.enableDynamicPricing && service.pricingRules) {
          const rules = service.pricingRules as any;
          const day = current.getDay();
          const hour = current.getHours();
          if (rules.peak?.days.includes(day) && hour >= rules.peak.hours[0] && hour <= rules.peak.hours[1]) {
            price = service.price * (rules.peak.multiplier || 1);
            priceLabel = "🔥 Пик";
          }
        }
        slots.push({
          start: format(current, "HH:mm"),
          end: format(slotEnd, "HH:mm"),
          available: true,
          price,
          priceLabel
        });
      }
      current = addMinutes(current, business.slotDuration);
    }
    return slots;
  }

  async function findNextAvailableSlot(
    businessId: string,
    serviceId: string,
    staffId: string | null,
    fromDate: Date,
    maxDaysAhead: number = 30
  ) {
    for (let i = 1; i <= maxDaysAhead; i++) {
      const checkDate = addDays(fromDate, i);
      const dateStr = format(checkDate, "yyyy-MM-dd");
      
      const slots = await getAvailableSlots(businessId, serviceId, staffId, dateStr);
      if (slots.length > 0) {
        return {
          date: checkDate,
          time: slots[0].start,
          staffId: staffId // В упрощенном варианте возвращаем тот же staffId
        };
      }
    }
    return null;
  }

  function generateTimeSlots(start: string, end: string, duration: number): string[] {
    const slots = [];
    let current = parse(start, "HH:mm", new Date());
    const endTime = parse(end, "HH:mm", new Date());
    while (current < endTime) {
      slots.push(format(current, "HH:mm"));
      current = addMinutes(current, duration);
    }
    return slots;
  }

  // --- API Routes ---

  // API: Валидация и применение промокода
  app.post('/api/promocodes/validate', async (req, res) => {
    try {
      const { code, serviceId, originalPrice, businessId } = req.body;
      
      if (!code || !businessId) {
        return res.status(400).json({ error: 'Код и ID бизнеса обязательны' });
      }

      const promo = await prisma.promocode.findFirst({
        where: { 
          code: code.toUpperCase(),
          businessId,
          isActive: true
        }
      });
      
      if (!promo) {
        return res.status(404).json({ error: 'Промокод не найден' });
      }
      
      // Проверки валидности
      const now = new Date();
      
      if (promo.validFrom && new Date(promo.validFrom) > now) {
        return res.status(400).json({ error: 'Промокод ещё не активен' });
      }
      
      if (promo.validUntil && new Date(promo.validUntil) < now) {
        return res.status(400).json({ error: 'Промокод истёк' });
      }
      
      if (promo.maxUses && promo.usedCount >= promo.maxUses) {
        return res.status(400).json({ error: 'Промокод исчерпан' });
      }
      
      if (promo.minOrderAmount && Number(originalPrice) < Number(promo.minOrderAmount)) {
        return res.status(400).json({ 
          error: `Минимальная сумма заказа: ${promo.minOrderAmount} ₽` 
        });
      }
      
      // Проверка применимости к услуге
      let applicableServices = [];
      try {
        applicableServices = JSON.parse(promo.applicableServices || "[]");
      } catch (e) {
        applicableServices = [];
      }

      if (applicableServices.length > 0) {
        if (!applicableServices.includes(serviceId)) {
          return res.status(400).json({ error: 'Промокод не применим к этой услуге' });
        }
      }
      
      // Рассчитать скидку
      let discountAmount = 0;
      const price = Number(originalPrice);
      
      if (promo.discountType === 'percent') {
        discountAmount = Math.round(price * Number(promo.discountValue) / 100);
      } else if (promo.discountType === 'fixed') {
        discountAmount = Math.min(Number(promo.discountValue), price);
      }
      
      const finalPrice = Math.max(0, price - discountAmount);
      
      res.json({
        valid: true,
        promocodeId: promo.id,
        discountType: promo.discountType,
        discountValue: Number(promo.discountValue),
        discountAmount,
        originalPrice: price,
        finalPrice,
        message: promo.discountType === 'percent' 
          ? `Скидка ${promo.discountValue}% (-${discountAmount} ₽)`
          : `Скидка ${discountAmount} ₽`
      });
    } catch (error) {
      console.error("Promocode validation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get promocodes for business
  app.get("/api/promocodes", async (req, res) => {
    try {
      const promocodes = await prisma.promocode.findMany({
        where: { businessId: req.query.businessId as string }
      });
      res.json(promocodes);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/promocodes", async (req, res) => {
    try {
      const { applicableServices, ...rest } = req.body;
      const promo = await prisma.promocode.create({
        data: {
          ...rest,
          code: rest.code.toUpperCase(),
          applicableServices: JSON.stringify(applicableServices || []),
          validFrom: new Date(rest.validFrom),
          validUntil: rest.validUntil ? new Date(rest.validUntil) : null,
        }
      });
      res.json(promo);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/promocodes/:id", async (req, res) => {
    try {
      await prisma.promocode.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Payment creation
  app.post("/api/bookings/:id/create-payment", async (req, res) => {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: { service: true, business: true }
      });

      if (!booking || !booking.business.paymentEnabled) {
        return res.status(400).json({ error: 'Оплата не подключена или запись не найдена' });
      }

      const business = booking.business;
      const yookassa = new (YooKassa as any)({
        shopId: business.yukassaShopId!,
        secretKey: business.yukassaSecretKey!
      });

      const amount = business.requirePrepayment 
        ? (booking.service.price * business.prepaymentPercent / 100)
        : booking.service.price;

      const payment = await yookassa.createPayment({
        amount: {
          value: amount.toFixed(2),
          currency: 'RUB'
        },
        confirmation: {
          type: 'redirect',
          return_url: `${process.env.APP_URL}/b/${booking.confirmHash}/success`
        },
        description: `Запись: ${booking.service.name}`,
        metadata: {
          bookingId: booking.id
        }
      });

      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentId: payment.id,
          paymentUrl: payment.confirmation.confirmation_url,
          totalPrice: booking.service.price,
          prepaidAmount: amount
        }
      });

      res.json({ paymentUrl: payment.confirmation.confirmation_url });
    } catch (error) {
      console.error("Payment error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // YooKassa Webhook
  app.post("/api/webhooks/yookassa", async (req, res) => {
    try {
      const event = req.body;
      if (event.event === 'payment.succeeded') {
        const bookingId = event.object.metadata.bookingId;
        const booking = await prisma.booking.update({
          where: { id: bookingId },
          data: {
            paymentStatus: 'paid',
            status: 'CONFIRMED'
          }
        });
        await logBookingChange(bookingId, 'paid', null, { paymentId: event.object.id });
      }
      res.sendStatus(200);
    } catch (error) {
      res.sendStatus(500);
    }
  });

  // Calendar .ics generation
  app.get("/api/bookings/:id/calendar", async (req, res) => {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: req.params.id },
        include: { service: true, business: true, staff: true }
      });

      if (!booking) return res.status(404).json({ error: 'Запись не найдена' });

      const start = booking.startTime;
      const event: any = {
        start: [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()],
        duration: { minutes: booking.service.durationMinutes },
        title: booking.service.name,
        description: `Мастер: ${booking.staff?.name}\nАдрес: ${booking.business.address}`,
        location: booking.business.address || '',
        url: `${process.env.APP_URL}/b/${booking.confirmHash}`,
        status: 'CONFIRMED',
        organizer: { name: booking.business.name, email: 'info@bookbot.app' }
      };

      createEvent(event, (error, value) => {
        if (error) return res.status(500).send(error);
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader('Content-Disposition', `attachment; filename="booking-${booking.id}.ics"`);
        res.send(value);
      });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Reviews API
  app.post("/api/reviews", async (req, res) => {
    try {
      const { bookingId, rating, text, photos } = req.body;
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { business: true }
      });

      if (!booking) return res.status(404).json({ error: 'Запись не найдена' });

      const review = await prisma.review.create({
        data: {
          bookingId,
          clientId: booking.clientId,
          businessId: booking.businessId,
          staffId: booking.staffId,
          rating,
          text,
          photos: JSON.stringify(photos || []),
          status: 'pending'
        }
      });

      res.json(review);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/reviews", async (req, res) => {
    try {
      const { businessId, status } = req.query;
      const reviews = await prisma.review.findMany({
        where: { 
          businessId: businessId as string,
          status: status as string || undefined
        },
        include: { client: true, staff: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/reviews/:id", async (req, res) => {
    try {
      const review = await prisma.review.update({
        where: { id: req.params.id },
        data: req.body
      });
      res.json(review);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get current user's business
  app.get('/api/businesses/me', authenticateJWT, async (req: any, res) => {
    try {
      if (req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Доступ запрещен' });
      }
      
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { business: true }
      });
      
      if (!user) {
        if (req.user.email) {
          const fallbackUser = await prisma.user.findUnique({
            where: { email: req.user.email },
            include: { business: true }
          });
          if (fallbackUser && fallbackUser.business) return res.json(fallbackUser.business);
        }
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      if (!user.business) {
        if (user.businessId) {
          const business = await prisma.business.findUnique({ where: { id: user.businessId } });
          if (business) return res.json(business);
        }
        
        const anyBiz = await prisma.business.findFirst({
          where: { users: { some: { id: user.id } } }
        });
        if (anyBiz) return res.json(anyBiz);

        return res.status(404).json({ error: 'Бизнес не найден' });
      }
      
      res.json(user.business);
    } catch (error) {
      console.error('Error in /api/businesses/me:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get business by slug
  app.get("/api/businesses/:slug", async (req, res) => {
    try {
      const business = await prisma.business.findUnique({
        where: { slug: req.params.slug },
        include: { services: { where: { isActive: true } }, staff: { where: { isActive: true } } }
      });
      if (!business) return res.status(404).json({ error: "Business not found" });
      res.json(business);
    } catch (error) {
      console.error("Error fetching business:", error);
      res.status(500).json({ error: "Internal server error", details: (error as Error).message });
    }
  });

  // Generate available slots
  app.get("/api/businesses/:slug/slots", async (req, res) => {
    const { date, staffId, serviceId } = req.query;
    if (!date || !serviceId) return res.status(400).json({ error: "Missing parameters" });

    try {
      const business = await prisma.business.findUnique({ where: { slug: req.params.slug } });
      if (!business) return res.status(404).json({ error: "Business not found" });

      const slots = await getAvailableSlots(business.id, serviceId as string, staffId as string || null, date as string);

      res.json({ slots, nextAvailable: null });
    } catch (error) {
      console.error("Error generating slots:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get configuration for chatbot (system prompt data)
  app.get("/api/chatbot-config/:businessId", async (req, res) => {
    try {
      const business = await prisma.business.findUnique({
        where: { id: req.params.businessId },
        include: {
          services: { where: { isActive: true } },
          staff: { where: { isActive: true } }
        }
      });
      if (!business) return res.status(404).json({ error: "Business not found" });
      res.json(business);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Chatbot logic using @google/genai (Server-side)
  app.post("/api/chat", async (req, res) => {
    const { businessId, message, history = [] } = req.body;
    try {
      if (!businessId || !message) {
        return res.status(400).json({ error: "Missing businessId or message" });
      }

      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          services: { where: { isActive: true } },
          staff: { where: { isActive: true } }
        }
      });

      if (!business) {
        return res.status(404).json({ error: "Business not found" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY is not set in environment");
        return res.status(500).json({ error: "Конфигурация ИИ не завершена (отсутствует ключ)" });
      }

      // Initialize AI
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: `Ты — AI администратор сервиса онлайн-записи "${business.name}". 
Твоя задача: вежливо и профессионально помогать клиентам записываться на услуги.

Информация о бизнесе:
Название: ${business.name}
Адрес: ${business.address || "Не указан"}
Описание: ${business.description || "Не указано"}

Доступные услуги:
${business.services.map((s: any) => `- ID: ${s.id}, Название: ${s.name}, Цена: ${s.price} руб, Длительность: ${s.durationMinutes} мин`).join("\n")}

Сотрудники (Мастера):
${business.staff.map((s: any) => `- ID: ${s.id}, Имя: ${s.name}, Био/Описание: ${s.bio || "Специалист"}`).join("\n")}

ПРАВИЛА:
1. Если клиент хочет записаться, обязательно уточни услугу, дату и время. Используй get_available_slots для проверки.
2. Перед финальным созданием записи (create_booking) обязательно уточни ИМЯ и ТЕЛЕФОН клиента.
3. Отвечай кратко и только на русском языке.
4. Сегодняшняя дата: ${new Date().toLocaleDateString("ru-RU", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`,
        tools: [
          {
            functionDeclarations: [
              {
                name: "get_available_slots",
                description: "Получить свободные слоты для записи на определенную дату",
                parameters: {
                  type: SchemaType.OBJECT,
                  properties: {
                    date: { type: SchemaType.STRING, description: "Дата в формате YYYY-MM-DD" },
                    serviceId: { type: SchemaType.STRING, description: "ID услуги" },
                    staffId: { type: SchemaType.STRING, description: "Необязательно: ID сотрудника" }
                  },
                  required: ["date", "serviceId"]
                }
              },
              {
                name: "create_booking",
                description: "Создать запись в базе данных",
                parameters: {
                  type: SchemaType.OBJECT,
                  properties: {
                    serviceId: { type: SchemaType.STRING },
                    staffId: { type: SchemaType.STRING },
                    startTime: { type: SchemaType.STRING, description: "ISO формат даты и времени" },
                    clientName: { type: SchemaType.STRING },
                    clientPhone: { type: SchemaType.STRING }
                  },
                  required: ["serviceId", "startTime", "clientName", "clientPhone"]
                }
              }
            ]
          }
        ]
      });

      // Clean and format history to ensure:
      // 1. The first message has the role 'user'.
      // 2. Roles alternate between 'user' and 'model'.
      let formattedHistory = (history || []).map((h: any) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text || "" }]
      }));

      // Strip any model/assistant messages from the start of the conversation history
      const firstUserIdx = formattedHistory.findIndex(h => h.role === 'user');
      if (firstUserIdx !== -1) {
        formattedHistory = formattedHistory.slice(firstUserIdx);
      } else {
        formattedHistory = [];
      }

      // Merge and alternate strictly
      const cleanHistory: any[] = [];
      for (const item of formattedHistory) {
        if (cleanHistory.length === 0) {
          cleanHistory.push(item);
        } else {
          const lastItem = cleanHistory[cleanHistory.length - 1];
          if (lastItem.role === item.role) {
            lastItem.parts[0].text = (lastItem.parts[0].text + "\n" + item.parts[0].text).trim();
          } else {
            cleanHistory.push(item);
          }
        }
      }

      const chat = model.startChat({
        history: cleanHistory
      });

      let aiResult = await chat.sendMessage(message);
      let aiResponse = aiResult.response;
      let toolCount = 0;
      const MAX_TOOLS = 5;

      // Handle function calls
      while (aiResponse.candidates?.[0]?.content?.parts?.some(p => p.functionCall) && toolCount < MAX_TOOLS) {
        toolCount++;
        const parts = aiResponse.candidates[0].content.parts;
        const toolResults = [];

        for (const part of parts) {
          if (!part.functionCall) continue;
          const { name, args } = part.functionCall;
          console.log(`[AI-Server] Calling tool ${name}:`, args);

          if (name === "get_available_slots") {
            try {
              const typedArgs = args as any;
              const slots = await getAvailableSlots(business.id, String(typedArgs.serviceId), typedArgs.staffId ? String(typedArgs.staffId) : null, String(typedArgs.date));
              toolResults.push({
                functionResponse: { name, response: { slots: slots.slice(0, 10) } }
              });
            } catch (e: any) {
              toolResults.push({ functionResponse: { name, response: { error: e.message } } });
            }
          } else if (name === "create_booking") {
            try {
              const typedArgs = args as any;
              const serviceId = String(typedArgs.serviceId);
              const staffId = typedArgs.staffId ? String(typedArgs.staffId) : null;
              const startTime = String(typedArgs.startTime);
              const clientName = String(typedArgs.clientName);
              const clientPhone = String(typedArgs.clientPhone);

              const service = await prisma.service.findUnique({ where: { id: serviceId } });
              if (!service) throw new Error("Услуга не найдена");

              const startT = new Date(startTime);
              const endT = new Date(startT.getTime() + service.durationMinutes * 60000);
              const normalizedPhone = normalizePhone(clientPhone);

              let client = await prisma.client.findFirst({
                where: { phone: normalizedPhone }
              });
              if (!client) {
                client = await prisma.client.create({
                  data: { phone: normalizedPhone, name: clientName }
                } as any);
              }

              const booking = await prisma.booking.create({
                data: {
                  businessId: business.id,
                  serviceId: serviceId,
                  staffId: staffId,
                  clientId: client.id,
                  startTime: startT,
                  endTime: endT,
                  clientName: clientName,
                  clientPhone: normalizedPhone,
                  status: "CONFIRMED",
                  source: "CHATBOT",
                  totalPrice: service.price
                }
              } as any);

              toolResults.push({
                functionResponse: { name, response: { success: true, bookingId: booking.id } }
              });
            } catch (e: any) {
              toolResults.push({ functionResponse: { name, response: { error: e.message } } });
            }
          }
        }

        aiResult = await chat.sendMessage(toolResults);
        aiResponse = aiResult.response;
      }

      res.json({ text: aiResponse.text() });
    } catch (error: any) {
      console.error("[Chat-Server] Critical error:", error);
      // Return more detailed error to help debug
      const detail = error.response?.data?.error?.message || error.message || String(error);
      res.status(500).json({ error: `Ошибка сервера при обработке чата: ${detail}` });
    }
  });

  // Lock a slot
  // Lock a slot
  app.post("/api/bookings/lock", async (req, res) => {
    const { businessId, staffId, startTime } = req.body;
    const lockKey = `lock:${businessId}:${staffId || 'any'}:${startTime}`;
    
    try {
      const success = await setLock(lockKey, 300);
      if (!success) return res.status(409).json({ error: "Slot already locked" });
      res.json({ success: true });
    } catch (error) {
      console.error("Error locking slot:", error);
      res.status(500).json({ error: "Internal server error", details: (error as Error).message });
    }
  });

  // Create booking
  app.post("/api/bookings", async (req, res) => {
    const { 
      businessId, serviceId, staffId, startTime, 
      clientName, clientPhone, clientEmail,
      name, phone, email, // Fallback for frontend fields
      notes, 
      recurrenceRule, promocodeId,
      subscriptionPurchaseId, giftCertificateCode,
      referralCode, // Add this
      bookedForSelf = true, bookedByName, bookedByPhone, bookedByEmail, relationship,
      pointsSpent // Add this
    } = req.body;

    const actualName = clientName || name;
    const actualPhone = clientPhone || phone;
    const actualEmail = clientEmail || email;

    try {
      if (!businessId || !serviceId || !startTime || !actualPhone || !actualName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const business = await prisma.business.findUnique({ where: { id: businessId } });
      if (!business) return res.status(404).json({ error: "Business not found" });

      const service = await prisma.service.findUnique({ where: { id: serviceId } });
      if (!service) return res.status(404).json({ error: "Service not found" });

      const start = new Date(startTime);
      if (isNaN(start.getTime())) {
        return res.status(400).json({ error: "Invalid start time format" });
      }
      const end = addMinutes(start, service.durationMinutes);

      // Normalize phone number (digits only)
      const normalizedPhone = normalizePhone(actualPhone);

      let finalPrice = service.price;
      let discountAmount = 0;
      let paidBySubscription = false;

      // Handle Subscription (Feature 6)
      if (subscriptionPurchaseId) {
        const purchase = await prisma.subscriptionPurchase.findUnique({ where: { id: subscriptionPurchaseId } });
        if (purchase) {
          if (purchase.usedVisits >= purchase.totalVisits) return res.status(400).json({ error: 'Абонемент исчерпан' });
          if (purchase.expiresAt < new Date()) return res.status(400).json({ error: 'Абонемент истёк' });
          
          await prisma.subscriptionPurchase.update({
            where: { id: subscriptionPurchaseId },
            data: { usedVisits: { increment: 1 } }
          });
          finalPrice = 0;
          paidBySubscription = true;
        }
      }

      // Handle Gift Certificate (Feature 6)
      if (giftCertificateCode && !paidBySubscription) {
        const cert = await prisma.giftCertificate.findUnique({ where: { code: giftCertificateCode } });
        if (cert && !cert.isUsed && cert.expiresAt > new Date()) {
          const applyAmount = Math.min(finalPrice, cert.remainingAmount);
          finalPrice -= applyAmount;
          discountAmount += applyAmount;
          
          await prisma.giftCertificate.update({
            where: { id: cert.id },
            data: { 
              remainingAmount: { decrement: applyAmount },
              isUsed: cert.remainingAmount - applyAmount <= 0
            }
          });
        }
      }

      if (promocodeId && !paidBySubscription) {
        const promo = await prisma.promocode.findUnique({ where: { id: promocodeId } });
        if (promo) {
          let promoDiscount = 0;
          if (promo.discountType === 'percent') {
            promoDiscount = (service.price * Number(promo.discountValue)) / 100;
          } else {
            promoDiscount = Number(promo.discountValue);
          }
          discountAmount += promoDiscount;
          finalPrice = Math.max(0, finalPrice - promoDiscount);
        }
      }

      // Handle Referral Discount
      let appliedReferralLinkId = null;
      let appliedReferralSplitPercent = 50;

      if (referralCode && !paidBySubscription && business.isReferralEnabled) {
        const referralLink = await prisma.referralLink.findUnique({
          where: { code: referralCode },
          include: { client: true }
        });

        if (referralLink && referralLink.businessId === businessId) {
          const totalRewardPercent = business.referralRewardPercent || 10;
          const sharePercent = referralLink.client.referralSharePercent ?? 50; // % going to Referrer
          const friendDiscountPercent = (100 - sharePercent) * (totalRewardPercent / 100);
          
          const referralDiscount = (service.price * friendDiscountPercent) / 100;
          discountAmount += referralDiscount;
          finalPrice = Math.max(0, finalPrice - referralDiscount);
          
          appliedReferralLinkId = referralLink.id;
          appliedReferralSplitPercent = sharePercent;
        }
      }

      // Handle Loyalty Points Spending
      if (pointsSpent && pointsSpent > 0 && !paidBySubscription) {
        if (business.loyaltyEnabled) {
          const clientForLoyalty = await prisma.client.findFirst({
            where: {
              OR: [
                { phone: normalizedPhone },
                { phone: `+${normalizedPhone}` }
              ]
            }
          });

          if (clientForLoyalty && clientForLoyalty.loyaltyPoints >= pointsSpent) {
            const maxPointsDiscount = Math.floor((service.price - discountAmount) * (business.loyaltyMaxSpend / 100));
            const actualPointsToSpend = Math.min(pointsSpent, clientForLoyalty.loyaltyPoints, maxPointsDiscount, finalPrice);
            
            if (actualPointsToSpend > 0) {
              finalPrice -= actualPointsToSpend;
              discountAmount += actualPointsToSpend;
            }
          }
        }
      }

      // --- Staff Assignment Logic (especially for "Any Master") ---
      let assignedStaffId = staffId;
      
      if (!assignedStaffId) {
        const allStaff = await prisma.staff.findMany({
          where: { businessId, isActive: true }
        });

        const bookingsAtTime = await prisma.booking.findMany({
          where: {
            businessId,
            status: { not: "CANCELLED" },
            OR: [
              { startTime: { lte: start }, endTime: { gt: start } },
              { startTime: { lt: end }, endTime: { gte: end } },
              { startTime: { gte: start }, endTime: { lte: end } }
            ]
          },
          select: { staffId: true }
        });
        const bookedStaffIds = new Set(bookingsAtTime.map(b => b.staffId));
        const availableStaff = allStaff.find(s => !bookedStaffIds.has(s.id));
        
        if (!availableStaff) {
          return res.status(409).json({ error: "Нет свободных мастеров на это время" });
        }
        assignedStaffId = availableStaff.id;
      } else {
        const existing = await prisma.booking.findFirst({
          where: { 
            staffId: assignedStaffId, 
            status: { not: "CANCELLED" },
            OR: [
              { startTime: { lte: start }, endTime: { gt: start } },
              { startTime: { lt: end }, endTime: { gte: end } },
              { startTime: { gte: start }, endTime: { lte: end } }
            ]
          }
        });
        if (existing) return res.status(409).json({ error: "Мастер уже занят на это время" });
      }

      // Auto-confirm logic
      let status: any = 'PENDING';
      let approvalRequiredList: string[] = [];
      try {
        approvalRequiredList = JSON.parse(business.requireApprovalFor || "[]");
      } catch (e) {
        approvalRequiredList = [];
      }
      
      if (business.autoConfirmBookings && !approvalRequiredList.includes(serviceId)) {
        status = 'CONFIRMED';
      }

      // Create or get client (the one who will visit)
      // Check both normalized and possibly prefixed version for legacy support
      let client = await prisma.client.findFirst({ 
        where: { 
          OR: [
            { phone: normalizedPhone },
            { phone: `+${normalizedPhone}` },
            actualEmail ? { email: { equals: actualEmail.trim().toLowerCase() } } : { phone: 'NEVER_MATCH' }
          ]
        } 
      });
      
      if (!client) {
        client = await prisma.client.create({
          data: { phone: normalizedPhone, name: actualName, email: actualEmail }
        });
      }

      const commonData = {
        businessId,
        serviceId,
        staffId: assignedStaffId,
        clientId: client.id,
        clientName: actualName,
        clientPhone: normalizedPhone,
        clientEmail: actualEmail,
        notes,
        status,
        source: req.body.source || "WIDGET",
        totalPrice: finalPrice,
        discountAmount,
        pointsSpent: pointsSpent || 0,
        paidBySubscription,
        subscriptionPurchaseId,
        bookedForSelf,
        bookedByName: !bookedForSelf ? bookedByName : null,
        bookedByPhone: !bookedForSelf ? bookedByPhone : null,
        bookedByEmail: !bookedForSelf ? bookedByEmail : null,
        relationship: !bookedForSelf ? relationship : null
      };

      // Handle Recurring
      if (recurrenceRule && recurrenceRule.type !== 'none') {
        const groupId = Math.random().toString(36).substring(7);
        const dates: Date[] = [start];
        let nextDate = start;
        const count = recurrenceRule.count || 5;
        
        for (let i = 1; i < count; i++) {
          if (recurrenceRule.type === 'weekly') nextDate = addWeeks(nextDate, recurrenceRule.interval || 1);
          else if (recurrenceRule.type === 'biweekly') nextDate = addWeeks(nextDate, (recurrenceRule.interval || 1) * 2);
          else if (recurrenceRule.type === 'monthly') nextDate = addMonths(nextDate, recurrenceRule.interval || 1);
          dates.push(new Date(nextDate));
        }

        const createdBookings = await prisma.$transaction(
          dates.map((date, index) => prisma.booking.create({
            data: {
              ...commonData,
              startTime: date,
              endTime: addMinutes(date, service.durationMinutes),
              recurringGroupId: groupId,
              recurrenceIndex: index + 1,
              recurrenceTotal: dates.length,
              recurrenceRule
            }
          }))
        );

        for (const b of createdBookings) await logBookingChange(b.id, 'created', null, b, 'client');
        await deleteLock(`lock:${businessId}:${staffId || 'any'}:${format(start, "yyyy-MM-dd-HH-mm")}`);
        return res.json(createdBookings[0]);
      }

      const booking = await prisma.booking.create({
        data: {
          ...commonData,
          startTime: start,
          endTime: end,
          pointsSpent: pointsSpent || 0,
          referralLinkId: appliedReferralLinkId,
          referralSplitPercent: appliedReferralSplitPercent,
          discountAmount: discountAmount || 0,
          totalPrice: finalPrice
        }
      });

      if (pointsSpent && pointsSpent > 0) {
        await prisma.$transaction([
          prisma.client.update({
            where: { id: client.id },
            data: { loyaltyPoints: { decrement: pointsSpent } }
          }),
          prisma.loyaltyTransaction.create({
            data: {
              clientId: client.id,
              businessId: businessId,
              bookingId: booking.id,
              type: 'SPEND',
              points: -pointsSpent,
              description: `Списание баллов за визит #${booking.id.slice(-6).toUpperCase()}`
            }
          })
        ]);
      }

      if (promocodeId) {
        await prisma.promocode.update({ where: { id: promocodeId }, data: { usedCount: { increment: 1 } } });
        await prisma.promocodeUsage.create({ data: { promocodeId, bookingId: booking.id, clientId: client.id, discountAmount } });
      }

      await logBookingChange(booking.id, 'created', null, booking, 'client');
      await deleteLock(`lock:${businessId}:${staffId || 'any'}:${format(start, "yyyy-MM-dd-HH-mm")}`);

      // Notifications (Feature 8 & 9)
      const msg = `Ваша запись на ${service.name} подтверждена! Ждем вас ${format(start, 'dd.MM HH:mm', { locale: ru })}.`;
      await sendNotification(client, msg);
      
      if (!bookedForSelf && bookedByPhone && bookedByPhone !== normalizedPhone) {
        const bookerMsg = `Вы записали ${actualName} на ${service.name} (${format(start, 'dd.MM HH:mm', { locale: ru })}).`;
        // We'd need a Client record for the booker too if we want to use sendNotification properly, 
        // but for now we can just mock it or send SMS directly.
        console.log(`[SMS to Booker ${bookedByPhone}]: ${bookerMsg}`);
      }

      res.json(booking);
    } catch (error) {
      console.error("Error creating booking:", error);
      res.status(500).json({ error: "Internal server error", details: (error as Error).message });
    }
  });

  // Confirm/Cancel via hash (Feature 2)
  app.get("/api/bookings/by-hash/:hash", async (req, res) => {
    try {
      const booking = await prisma.booking.findUnique({
        where: { confirmHash: req.params.hash },
        include: { service: true, business: true, staff: true }
      });
      if (!booking) return res.status(404).json({ error: 'Запись не найдена' });
      res.json(booking);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/b/:hash/confirm", async (req, res) => {
    try {
      const booking = await prisma.booking.findUnique({
        where: { confirmHash: req.params.hash },
        include: { service: true }
      });
      
      if (!booking) return res.status(404).send("Запись не найдена");
      
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CONFIRMED' }
      });

      await logBookingChange(booking.id, 'confirmed', { status: booking.status }, { status: 'CONFIRMED' }, 'client');
      
      res.send(`
        <html>
          <body style="text-align:center; padding:50px; font-family: sans-serif;">
            <h1 style="color: #059669;">✅ Запись подтверждена!</h1>
            <p>Ждём вас ${format(booking.startTime, 'dd.MM.yyyy в HH:mm')}</p>
            <p>${booking.service.name}</p>
          </body>
        </html>
      `);
    } catch (error) {
      res.status(500).send("Internal server error");
    }
  });

  app.get("/b/:hash/cancel", async (req, res) => {
    res.redirect(`/book/cancel/${req.params.hash}`);
  });

  app.post("/api/bookings/:hash/cancel", async (req, res) => {
    const { reason } = req.body;
    try {
      const booking = await prisma.booking.findUnique({
        where: { confirmHash: req.params.hash }
      });
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED', notes: booking.notes ? `${booking.notes}\nReason: ${reason}` : `Reason: ${reason}` }
      });

      await logBookingChange(booking.id, 'cancelled', { status: booking.status }, { status: 'CANCELLED' }, 'client');

      const waitlist = await prisma.waitlist.findMany({
        where: {
          businessId: booking.businessId,
          requestedDate: startOfDay(booking.startTime),
          requestedTime: format(booking.startTime, "HH:mm"),
          notified: false
        },
        include: { client: true }
      });

      for (const entry of waitlist) {
        console.log(`NOTIFY WAITLIST: SMS to ${entry.client.phone}: Освободилось место! Забронировать: ${process.env.APP_URL}/w/${entry.claimHash}`);
        await prisma.waitlist.update({
          where: { id: entry.id },
          data: { notified: true, expiresAt: addMinutes(new Date(), 30) }
        });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Waitlist Claim (Feature 7)
  app.get("/w/:hash", async (req, res) => {
    try {
      const entry = await prisma.waitlist.findUnique({
        where: { claimHash: req.params.hash },
        include: { client: true, service: true }
      });
      
      if (!entry || (entry.expiresAt && entry.expiresAt < new Date())) {
        return res.send("Слот уже забрали или время истекло");
      }

      const start = parse(`${format(entry.requestedDate, 'yyyy-MM-dd')} ${entry.requestedTime}`, "yyyy-MM-dd HH:mm", new Date());
      const end = addMinutes(start, entry.service.durationMinutes);

      const existing = await prisma.booking.findFirst({
        where: {
          businessId: entry.businessId,
          startTime: start,
          status: { not: "CANCELLED" }
        }
      });

      if (existing) return res.send("Извините, этот слот уже занят кем-то другим.");

      const booking = await prisma.booking.create({
        data: {
          businessId: entry.businessId,
          serviceId: entry.serviceId,
          staffId: entry.staffId || '', 
          clientId: entry.clientId,
          startTime: start,
          endTime: end,
          clientName: entry.client.name,
          clientPhone: entry.client.phone,
          status: 'CONFIRMED'
        }
      });

      await logBookingChange(booking.id, 'created', null, booking, 'waitlist');
      await prisma.waitlist.delete({ where: { id: entry.id } });

      res.send(`
        <html>
          <body style="text-align:center; padding:50px; font-family: sans-serif;">
            <h1 style="color: #059669;">✅ Слот забронирован!</h1>
            <p>Ждём вас ${format(start, 'dd.MM.yyyy в HH:mm')}</p>
          </body>
        </html>
      `);
    } catch (error) {
      res.status(500).send("Internal server error");
    }
  });

  app.post("/api/waitlist", async (req, res) => {
    const { businessId, serviceId, date, time, clientName, clientPhone } = req.body;
    try {
      let client = await prisma.client.findUnique({ where: { phone: clientPhone } });
      if (!client) {
        client = await prisma.client.create({ data: { phone: clientPhone, name: clientName } });
      }

      const entry = await prisma.waitlist.create({
        data: {
          businessId,
          serviceId,
          requestedDate: startOfDay(new Date(date)),
          requestedTime: time,
          clientId: client.id
        }
      });
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Portfolio Photos (Feature 8)
  app.get("/api/staff/:id/photos", async (req, res) => {
    try {
      const photos = await prisma.portfolioPhoto.findMany({
        where: { staffId: req.params.id },
        orderBy: { createdAt: 'desc' }
      });
      res.json(photos);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/staff/:id/photos", async (req, res) => {
    const { imageUrl, caption, category } = req.body;
    try {
      const photo = await prisma.portfolioPhoto.create({
        data: {
          staffId: req.params.id,
          imageUrl: imageUrl || `https://picsum.photos/seed/${Math.random()}/800/600`,
          caption,
          category
        }
      });
      res.json(photo);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get bookings for CRM
  app.get("/api/businesses/:slug/bookings", async (req, res) => {
    try {
      const business = await prisma.business.findUnique({ where: { slug: req.params.slug } });
      if (!business) return res.status(404).json({ error: "Business not found" });

      const bookings = await prisma.booking.findMany({
        where: { businessId: business.id },
        include: { service: true, staff: true },
        orderBy: { startTime: 'asc' }
      });
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ error: "Internal server error", details: (error as Error).message });
    }
  });

  // Update booking status
  app.patch("/api/bookings/:id/status", async (req, res) => {
    const { status } = req.body;
    try {
      const oldBooking = await prisma.booking.findUnique({ 
        where: { id: req.params.id },
        include: { business: true, client: true }
      });
      
      if (!oldBooking) return res.status(404).json({ error: 'Booking not found' });

      const booking = await prisma.booking.update({
        where: { id: req.params.id },
        data: { status },
        include: { business: true, client: true }
      });

      await logBookingChange(booking.id, 'STATUS_CHANGE', {
        old: oldBooking.status,
        new: status
      });

      if (status === 'COMPLETED' && oldBooking.status !== 'COMPLETED') {
        // Loyalty calculation
        const business = booking.business;
        if (business.loyaltyEnabled) {
          const finalPrice = booking.totalPrice || 0;
          const pointsEarned = Math.floor(finalPrice * business.loyaltyPercent / 100);
          
          if (pointsEarned > 0) {
            await prisma.$transaction([
              prisma.client.update({
                where: { id: booking.clientId },
                data: { loyaltyPoints: { increment: pointsEarned } }
              }),
              prisma.booking.update({
                where: { id: booking.id },
                data: { pointsEarned }
              }),
              prisma.loyaltyTransaction.create({
                data: {
                  clientId: booking.clientId,
                  businessId: booking.businessId,
                  bookingId: booking.id,
                  type: 'EARN',
                  points: pointsEarned,
                  description: `Начисление за визит #${booking.id.slice(-6).toUpperCase()}`
                }
              })
            ]);

            // Notify via Telegram if connected
            if (booking.client.telegramChatId) {
              await sendTelegramNotification(
                booking.client.telegramChatId,
                `🎁 Вам начислено <b>${pointsEarned}</b> баллов за визит!\nВаш баланс: <b>${booking.client.loyaltyPoints + pointsEarned}</b>`
              );
            }
          }
        }

        // --- Referral Reward Splitting ---
        if (booking.referralLinkId && !booking.referralRewardApplied) {
          const rLink = await prisma.referralLink.findUnique({
            where: { id: booking.referralLinkId },
            include: { client: true }
          });

          if (rLink && business.isReferralEnabled) {
            const totalRewardPercent = business.referralRewardPercent || 10;
            const splitToReferrer = booking.referralSplitPercent ?? 50;
            const referrerRewardPoints = Math.floor((booking.totalPrice || 0) * (splitToReferrer * totalRewardPercent / 10000));

            if (referrerRewardPoints > 0) {
              await prisma.$transaction([
                prisma.client.update({
                  where: { id: rLink.clientId },
                  data: { referralPoints: { increment: referrerRewardPoints }, loyaltyPoints: { increment: referrerRewardPoints } }
                }),
                prisma.loyaltyTransaction.create({
                  data: {
                    clientId: rLink.clientId,
                    businessId: booking.businessId,
                    bookingId: booking.id,
                    type: 'EARN',
                    points: referrerRewardPoints,
                    description: `Реферальное вознаграждение за визит #${booking.id.slice(-6).toUpperCase()}`
                  }
                }),
                prisma.booking.update({
                  where: { id: booking.id },
                  data: { referralRewardApplied: true }
                })
              ]);

              if (rLink.client.telegramChatId) {
                 await sendTelegramNotification(
                    rLink.client.telegramChatId,
                    `💰 Вам начислено реферальное вознаграждение <b>${referrerRewardPoints}</b> баллов за рекомендацию ${business.name}!`
                 );
              }
            }
          }
        }

        // Mock review reminder after 2 hours
        console.log(`REVIEW REMINDER: SMS to ${booking.clientPhone}: Как вам визит? Оставьте отзыв: ${process.env.APP_URL}/review/${booking.confirmHash}`);
      }

      res.json(booking);
    } catch (error) {
      console.error("Error updating booking status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/bookings/:id/audits", async (req, res) => {
    try {
      const audits = await prisma.bookingAudit.findMany({
        where: { bookingId: req.params.id },
        orderBy: { createdAt: 'desc' }
      });
      res.json(audits);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Loyalty endpoints
  app.get('/api/client/loyalty', authenticateJWT, async (req: any, res) => {
    try {
      const currentClient = await prisma.client.findUnique({ where: { id: req.user.id } });
      
      // Find all matching records for this identity
      const clients = await prisma.client.findMany({
        where: { 
          OR: [
            { id: req.user.id },
            currentClient?.email ? { email: { equals: currentClient.email.toLowerCase() } } : { id: 'NEVER_MATCH' },
            currentClient?.phone ? { phone: currentClient.phone } : { id: 'NEVER_MATCH' },
            req.user.email ? { email: { equals: req.user.email.toLowerCase() } } : { id: 'NEVER_MATCH' }
          ]
        }
      });

      const clientIds = clients.map(c => c.id);
      const totalBalance = clients.reduce((sum, c) => sum + (c.loyaltyPoints || 0), 0);

      const transactions = await prisma.loyaltyTransaction.findMany({
        where: { clientId: { in: clientIds } },
        include: { business: true },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ balance: totalBalance, transactions });
    } catch (error) {
      console.error('Loyalty fetch error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/booking/apply-points', async (req, res) => {
    try {
      const { points, clientId, businessId, finalPrice } = req.body;
      
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      const business = await prisma.business.findUnique({ where: { id: businessId } });

      if (!client || !business) return res.status(404).json({ error: 'Data not found' });
      if (!business.loyaltyEnabled) return res.status(400).json({ error: 'Loyalty program disabled' });

      if (points > client.loyaltyPoints) {
        return res.status(400).json({ error: 'Недостаточно баллов' });
      }

      const maxPointsDiscount = Math.floor(finalPrice * (business.loyaltyMaxSpend / 100));
      const appliedPoints = Math.min(points, maxPointsDiscount, finalPrice);
      const newFinalPrice = Math.floor(finalPrice - appliedPoints);

      res.json({ appliedPoints, newFinalPrice });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/business/loyalty-settings', authenticateJWT, async (req: any, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { business: true }
      });
      if (!user?.business) return res.status(404).json({ error: 'Business not found' });
      
      const { loyaltyEnabled, loyaltyPercent, loyaltyMaxSpend, loyaltyExpireDays, isReferralEnabled, referralRewardPercent } = user.business;
      res.json({ loyaltyEnabled, loyaltyPercent, loyaltyMaxSpend, loyaltyExpireDays, isReferralEnabled, referralRewardPercent });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/api/business/loyalty-settings', authenticateJWT, async (req: any, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id }
      });
      if (!user?.businessId) return res.status(403).json({ error: 'Forbidden' });

      const updated = await prisma.business.update({
        where: { id: user.businessId },
        data: req.body
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Services CRUD
  app.get("/api/services", async (req, res) => {
    const { businessId } = req.query;
    try {
      const services = await prisma.service.findMany({
        where: businessId ? { businessId: businessId as string } : {},
        orderBy: { sortOrder: 'asc' }
      });
      res.json(services);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/services", async (req, res) => {
    try {
      const service = await prisma.service.create({ data: req.body });
      res.json(service);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/services/:id", async (req, res) => {
    try {
      const service = await prisma.service.update({
        where: { id: req.params.id },
        data: req.body
      });
      res.json(service);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/services/:id", async (req, res) => {
    try {
      await prisma.service.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Staff CRUD
  app.get("/api/staff", async (req, res) => {
    const { businessId } = req.query;
    try {
      const staff = await prisma.staff.findMany({
        where: businessId ? { businessId: businessId as string } : {}
      });
      res.json(staff);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/staff", async (req, res) => {
    try {
      console.log("Creating staff with data:", req.body);
      const staff = await prisma.staff.create({ data: req.body });
      res.json(staff);
    } catch (error) {
      console.error("Error creating staff:", error);
      res.status(500).json({ error: "Internal server error", details: (error as Error).message });
    }
  });

  app.patch("/api/staff/:id", async (req, res) => {
    try {
      console.log(`Updating staff ${req.params.id} with data:`, req.body);
      const staff = await prisma.staff.update({
        where: { id: req.params.id },
        data: req.body
      });
      res.json(staff);
    } catch (error) {
      console.error("Error updating staff:", error);
      res.status(500).json({ error: "Internal server error", details: (error as Error).message });
    }
  });

  app.delete("/api/staff/:id", async (req, res) => {
    try {
      await prisma.staff.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ФИЧА 1: Поиск существующего клиента по телефону (Lookup)
  app.post("/api/clients/lookup", async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone is required" });

    try {
      const client = await prisma.client.findUnique({
        where: { phone }
      });

      if (client) {
        return res.json({
          found: true,
          name: client.name,
          email: client.email,
          message: "Мы вас помним! 👋"
        });
      }
      res.json({ found: false });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ФИЧА 2: Все свободные слоты на дату (Flow "По дате")
  app.get("/api/businesses/:slug/all-slots", async (req, res) => {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Date is required" });

    try {
      const business = await prisma.business.findUnique({
        where: { slug: req.params.slug },
        include: { staff: { where: { isActive: true } } }
      });
      if (!business) return res.status(404).json({ error: "Business not found" });

      const allSlotsMap: Record<string, any[]> = {};

      for (const staff of business.staff) {
        const dayOfWeek = format(new Date(date as string), "eee").toLowerCase();
        const workingHours = (staff.workingHours as any)?.[dayOfWeek] || (business.workingHours as any)[dayOfWeek];
        
        if (!workingHours || !workingHours.isWorking) continue;

        const slots = generateTimeSlots(workingHours.start, workingHours.end, business.slotDuration);
        
        const bookings = await prisma.booking.findMany({
          where: {
            staffId: staff.id,
            startTime: { gte: startOfDay(new Date(date as string)), lt: endOfDay(new Date(date as string)) },
            status: { not: "CANCELLED" }
          }
        });
        const bookedTimes = new Set();
        slots.forEach(time => {
          const slotStart = parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
          const slotEnd = addMinutes(slotStart, business.slotDuration); // Base duration for slot check
          
          const isBooked = bookings.some(b => {
            const bStart = new Date(b.startTime);
            const bEnd = new Date(b.endTime);
            return slotStart < bEnd && bStart < slotEnd;
          });
          
          if (isBooked) bookedTimes.add(time);
        });

        slots.forEach(time => {
          if (!bookedTimes.has(time)) {
            if (!allSlotsMap[time]) allSlotsMap[time] = [];
            allSlotsMap[time].push({ id: staff.id, name: staff.name });
          }
        });
      }

      const sortedSlots = Object.entries(allSlotsMap)
        .map(([time, staff]) => ({ time, availableStaff: staff }))
        .sort((a, b) => a.time.localeCompare(b.time));

      res.json(sortedSlots);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ФИЧА 4: Недельное расписание мастера
  app.get("/api/businesses/:slug/week-schedule", async (req, res) => {
    const { staffId, startDate } = req.query;
    if (!staffId || !startDate) return res.status(400).json({ error: "Missing parameters" });

    try {
      const business = await prisma.business.findUnique({ where: { slug: req.params.slug } });
      const staff = await prisma.staff.findUnique({ where: { id: staffId as string } });
      if (!business || !staff) return res.status(404).json({ error: "Not found" });

      const weekData = [];
      for (let i = 0; i < 7; i++) {
        const currentDate = addDays(new Date(startDate as string), i);
        const dayOfWeek = format(currentDate, "eee").toLowerCase();
        const dateStr = format(currentDate, "yyyy-MM-dd");

        const workingHours = (staff.workingHours as any)?.[dayOfWeek] || (business.workingHours as any)[dayOfWeek];
        
        if (!workingHours || (!workingHours.isOpen && !workingHours.isWorking)) {
          weekData.push({ date: currentDate, isWorkingDay: false, slots: [] });
          continue;
        }

        const allSlots = generateTimeSlots(workingHours.start, workingHours.end, business.slotDuration);
        const bookings = await prisma.booking.findMany({
          where: {
            staffId: staff.id,
            startTime: { gte: startOfDay(currentDate), lt: endOfDay(currentDate) },
            status: { not: "CANCELLED" }
          }
        });
        
        const daySlots = allSlots.map(time => {
          const slotStart = parse(`${dateStr} ${time}`, "yyyy-MM-dd HH:mm", new Date());
          const slotEnd = addMinutes(slotStart, business.slotDuration);
          
          const isBooked = bookings.some(b => {
            const bStart = new Date(b.startTime);
            const bEnd = new Date(b.endTime);
            return slotStart < bEnd && bStart < slotEnd;
          });

          return {
            time,
            available: !isBooked && isAfter(slotStart, new Date())
          };
        });

        weekData.push({
          date: currentDate,
          isWorkingDay: true,
          slots: daySlots
        });
      }

      res.json({ staffName: staff.name, days: weekData });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Clients
  app.get("/api/clients", async (req, res) => {
    const { search } = req.query;
    try {
      const clients = await prisma.client.findMany({
        where: search ? {
          OR: [
            { name: { contains: search as string } },
            { phone: { contains: search as string } }
          ]
        } : {},
        include: {
          _count: { select: { bookings: true } },
          bookings: {
            orderBy: { startTime: 'desc' },
            take: 1,
            select: { startTime: true }
          }
        }
      });
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await prisma.client.findUnique({
        where: { id: req.params.id },
        include: {
          bookings: {
            include: { service: true, staff: true },
            orderBy: { startTime: 'desc' }
          },
          loyaltyTransactions: {
            orderBy: { createdAt: 'desc' },
            take: 20
          }
        }
      });
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Dashboard Stats
  app.get("/api/dashboard/stats", async (req, res) => {
    const { businessId } = req.query;
    if (!businessId) return res.status(400).json({ error: "Missing businessId" });

    try {
      const today = startOfDay(new Date());
      const endOfToday = endOfDay(new Date());

      const [todayCount, pendingCount, confirmedCount, promocodeCount, reviewCount] = await Promise.all([
        prisma.booking.count({
          where: { businessId: businessId as string, startTime: { gte: today, lte: endOfToday } }
        }),
        prisma.booking.count({
          where: { businessId: businessId as string, status: 'PENDING' }
        }),
        prisma.booking.count({
          where: { businessId: businessId as string, status: 'CONFIRMED' }
        }),
        prisma.promocode.count({
          where: { businessId: businessId as string, isActive: true }
        }),
        prisma.review.count({
          where: { businessId: businessId as string, status: 'pending' }
        })
      ]);

      // Since SQLite aggregate is limited for joins, we do it manually or assume COMPLETED bookings have price
      const completedBookings = await prisma.booking.findMany({
        where: {
          businessId: businessId as string,
          status: 'COMPLETED',
          startTime: { gte: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) }
        },
        include: { service: true }
      });
      const revenue = completedBookings.reduce((acc, b) => acc + b.service.price, 0);

      res.json({
        today: todayCount,
        pending: pendingCount,
        confirmed: confirmedCount,
        promocodes: promocodeCount,
        reviews: reviewCount,
        revenue
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Business Settings
  app.patch("/api/business/:slug", authenticateJWT, async (req: any, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { business: true }
      });

      if (!user?.business || user.business.slug !== req.params.slug) {
        return res.status(403).json({ error: "Доступ запрещен. Вы можете редактировать только свой бизнес." });
      }

      console.log(`Updating business ${req.params.slug} with data:`, JSON.stringify(req.body, null, 2));
      
      const numericFields = [
        'slotDuration', 'bookingLeadTimeHours', 'maxBookingDaysAhead', 
        'prepaymentPercent', 'loyaltyPercent', 'loyaltyMaxSpend', 
        'loyaltyExpireDays', 'referralRewardPercent', 'latitude', 'longitude'
      ];

      const allowedFields = [
        'name', 'phone', 'address', 'workingHours', 'bookingRulesEnabled',
        'autoConfirmBookings', 'requireApprovalFor', 'smsEnabled', 'smsTemplate',
        'industry', 'subcategory', 'employeeCount', 'locationCount', 'ownerRole', 
        'logo', 'description', 'city', 'postalCode', 'timezone', 'currency', 
        'isPublished', 'district', 'categoryId', 'featuredUntil', 'coverImage',
        'paymentEnabled', 'paymentProvider', 'yukassaShopId', 'yukassaSecretKey',
        'requirePrepayment', 'loyaltyEnabled', 'isReferralEnabled', ...numericFields
      ];
      
      const data: any = {};
      Object.keys(req.body).forEach(key => {
        if (allowedFields.includes(key)) {
          if (numericFields.includes(key) && req.body[key] !== null) {
            data[key] = Number(req.body[key]);
          } else {
            data[key] = req.body[key];
          }
        }
      });

      if (data.categoryId === "" || data.categoryId === null) {
        data.categoryId = null;
      } else if (data.categoryId) {
        const cat = await prisma.category.findUnique({ where: { id: data.categoryId } });
        if (!cat) {
          console.warn(`Category ${data.categoryId} not found, setting to null`);
          data.categoryId = null;
        }
      }

      const business = await prisma.business.update({
        where: { slug: req.params.slug },
        data: data
      });

      res.json(business);
    } catch (error) {
      console.error("Error updating business:", error);
      res.status(500).json({ error: "Internal server error", details: (error as Error).message });
    }
  });

  // --- Subscriptions & Gift Certificates (Feature 6) ---
  app.get('/api/subscriptions', async (req, res) => {
    const { businessId } = req.query;
    const subs = await prisma.subscription.findMany({
      where: { businessId: businessId as string, isActive: true },
      include: { service: true }
    });
    res.json(subs);
  });

  app.post('/api/subscriptions', async (req, res) => {
    const { businessId, name, serviceId, totalVisits, price, originalPrice, validDays } = req.body;
    const sub = await prisma.subscription.create({
      data: { businessId, name, serviceId, totalVisits, price, originalPrice, validDays }
    });
    res.json(sub);
  });

  app.post('/api/subscriptions/:id/purchase', async (req, res) => {
    const { id } = req.params;
    const { clientId } = req.body;
    const sub = await prisma.subscription.findUnique({ where: { id } });
    if (!sub) return res.status(404).json({ error: 'Subscription not found' });

    const purchase = await prisma.subscriptionPurchase.create({
      data: {
        subscriptionId: sub.id,
        clientId,
        totalVisits: sub.totalVisits,
        expiresAt: addDays(new Date(), sub.validDays)
      }
    });
    res.json(purchase);
  });

  app.get('/api/clients/:clientId/subscriptions', async (req, res) => {
    const { clientId } = req.params;
    const purchases = await prisma.subscriptionPurchase.findMany({
      where: { clientId, paymentStatus: 'paid', expiresAt: { gte: new Date() } },
      include: { subscription: { include: { service: true } } }
    });
    res.json(purchases.filter(p => p.usedVisits < p.totalVisits));
  });

  app.post('/api/gift-certificates/create', async (req, res) => {
    const { businessId, amount, purchasedByName, recipientName, recipientEmail } = req.body;
    const code = `GIFT-${generateRandomCode(6)}`;
    const cert = await prisma.giftCertificate.create({
      data: {
        businessId,
        code,
        amount,
        remainingAmount: amount,
        purchasedByName,
        recipientName,
        recipientEmail,
        expiresAt: addDays(new Date(), 365)
      }
    });
    res.json(cert);
  });

  app.post('/api/gift-certificates/apply', async (req, res) => {
    const { code } = req.body;
    const cert = await prisma.giftCertificate.findUnique({ where: { code } });
    if (!cert) return res.status(404).json({ error: 'Сертификат не найден' });
    if (cert.isUsed) return res.status(400).json({ error: 'Сертификат уже использован' });
    if (cert.expiresAt < new Date()) return res.status(400).json({ error: 'Сертификат истёк' });
    res.json({ valid: true, remainingAmount: cert.remainingAmount, message: `Доступно ${cert.remainingAmount} ₽` });
  });

  // --- Auth Routes ---
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { role, email, phone, password, name } = req.body;
      console.log('Registration attempt:', { role, email, phone, name });
      
      if (!password) {
        return res.status(400).json({ error: 'Пароль обязателен' });
      }

      const normalizedPhone = normalizePhone(phone);
      const normalizedEmail = email ? email.toLowerCase().trim() : null;
      const hashedPassword = await bcrypt.hash(password, 10);

      if (role === 'owner') {
        if (!normalizedEmail) return res.status(400).json({ error: 'Email обязателен для бизнес-аккаунта' });
        
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { email: normalizedEmail },
              normalizedPhone ? { phone: normalizedPhone } : { phone: 'NEVER_MATCH' }
            ]
          }
        });
        if (existingUser) {
          console.log('User already exists:', normalizedEmail, normalizedPhone);
          return res.status(400).json({ error: 'Пользователь с таким email или телефоном уже существует' });
        }

        const user = await prisma.user.create({
          data: {
            email: normalizedEmail,
            phone: normalizedPhone,
            password: hashedPassword,
            name,
            role: 'owner'
          }
        });

        console.log('User created:', user.id);
        const token = generateJWT(user);
        return res.json({ token, user, message: 'Бизнес-аккаунт успешно создан!' });
      } else {
        if (!normalizedPhone) return res.status(400).json({ error: 'Телефон обязателен для клиента' });

        let client = await prisma.client.findUnique({ where: { phone: normalizedPhone } });
        if (client?.isRegistered) return res.status(400).json({ error: 'Клиент с таким номером уже зарегистрирован' });

        if (client) {
          client = await prisma.client.update({
            where: { phone: normalizedPhone },
            data: {
              email: normalizedEmail,
              password: hashedPassword,
              name: name || client.name,
              isRegistered: true
            }
          });
        } else {
          client = await prisma.client.create({
            data: {
              phone: normalizedPhone,
              email: normalizedEmail,
              password: hashedPassword,
              name,
              isRegistered: true
            }
          });
        }

        console.log('Client registered:', client.id);
        const token = generateJWT({ ...client, role: 'client' });
        
        // Get history count
        const bookingsCount = await prisma.booking.count({
          where: { clientPhone: normalizedPhone }
        });

        return res.json({ 
          token, 
          client, 
          message: bookingsCount > 0 
            ? `Добро пожаловать! Мы нашли ${bookingsCount} ваших прошлых записей.`
            : 'Аккаунт клиента успешно создан!' 
        });
      }
    } catch (error: any) {
      console.error('Registration error details:', error);
      res.status(500).json({ error: 'Ошибка при регистрации: ' + (error.message || 'Unknown error') });
    }
  });

  // API: Вход клиента (Task 3)
  app.post('/api/auth/client/login', async (req, res) => {
    try {
      const { phone, password } = req.body;
      
      const client = await prisma.client.findUnique({ where: { phone } });
      
      if (!client) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      if (!client.isRegistered || !client.password) {
        return res.status(400).json({ 
          error: 'Аккаунт не активирован. Пожалуйста, зарегистрируйтесь.',
          needsRegistration: true
        });
      }
      
      const isValid = await bcrypt.compare(password, client.password);
      
      if (!isValid) {
        return res.status(400).json({ error: 'Неверный пароль' });
      }
      
      const token = generateJWT(client);
      res.json({ token, client });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // API: Заметки о клиенте (Task 4)
  app.get('/api/clients/:id/notes', authenticateJWT, async (req: any, res) => {
    try {
      if (req.user.role !== 'owner') return res.status(403).json({ error: 'Доступ запрещен' });
      const notes = await prisma.clientNote.findMany({
        where: { clientId: req.params.id },
        orderBy: { createdAt: 'desc' }
      });
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/client-notes', authenticateJWT, async (req: any, res) => {
    try {
      if (req.user.role !== 'owner') return res.status(403).json({ error: 'Доступ запрещен' });
      const { clientId, businessId, text } = req.body;
      const note = await prisma.clientNote.create({
        data: {
          clientId,
          businessId,
          authorId: req.user.id,
          text
        }
      });
      res.json(note);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // API: Онбординг (Task 5)
  app.post('/api/businesses/onboarding', authenticateJWT, async (req: any, res) => {
    try {
      if (req.user.role !== 'owner') return res.status(403).json({ error: 'Доступ запрещен' });
      
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { business: true }
      });
      
      if (!user?.businessId) return res.status(404).json({ error: 'Бизнес не найден' });
      
      const data = req.body;
      const updatedBusiness = await prisma.business.update({
        where: { id: user.businessId },
        data: {
          name: data.companyName || user.business?.name,
          logo: data.logo,
          address: data.address,
          city: data.city,
          postalCode: data.postalCode,
          timezone: data.timezone,
          currency: data.currency,
          industry: data.industry,
          subcategory: data.subcategory,
          employeeCount: data.employeeCount,
          locationCount: data.locationCount,
          ownerRole: data.role,
          isPublished: true // Mark as published after onboarding
        }
      });
      
      res.json(updatedBusiness);
    } catch (error) {
      console.error('Onboarding error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { identifier, password, role } = req.body;
      console.log('Login attempt:', { identifier, role });
      
      if (!identifier || !password) {
        return res.status(400).json({ error: 'Идентификатор и пароль обязательны' });
      }

      const normalizedIdentifier = identifier ? normalizePhone(identifier) : null;
      const emailIdentifier = identifier ? identifier.toLowerCase().trim() : '';

      // Try searching for a business owner first
      let owner = null;
      try {
        owner = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: emailIdentifier } },
              normalizedIdentifier ? { phone: normalizedIdentifier } : { phone: 'NEVER_MATCH_BY_ID' }
            ]
          }
        });
      } catch (dbError) {
        console.error('Database error searching for owner:', dbError);
        throw dbError;
      }

      if (owner && owner.password) {
        try {
          const isValid = await bcrypt.compare(password, owner.password);
          if (isValid) {
            console.log('Owner login successful:', owner.id);
            const token = generateJWT(owner);
            return res.json({ token, user: owner });
          } else {
            console.log('Owner password mismatch for:', emailIdentifier);
          }
        } catch (compareError) {
          console.error('Bcrypt comparison error for owner:', compareError);
          // Don't throw, let it try client
        }
      } else {
        console.log('Owner user not found for:', identifier);
      }

      // If not an owner or password invalid, try client
      let client = null;
      try {
        client = await prisma.client.findFirst({
          where: {
            OR: [
              normalizedIdentifier ? { phone: normalizedIdentifier } : { phone: 'NEVER_MATCH_BY_ID_CLIENT' },
              { email: { equals: emailIdentifier } }
            ]
          }
        });
      } catch (dbError) {
        console.error('Database error searching for client:', dbError);
        throw dbError;
      }

      if (client && client.password) {
        try {
          const isValid = await bcrypt.compare(password, client.password);
          if (isValid) {
            console.log('Client login successful:', client.id);
            const token = generateJWT({ ...client, role: 'client' });
            return res.json({ token, client });
          } else {
            console.log('Client password mismatch for:', identifier);
          }
        } catch (compareError) {
          console.error('Bcrypt comparison error for client:', compareError);
        }
      } else if (!owner) {
        console.log('Client user not found for:', identifier);
      }

      // If both fail
      console.log('Login failed for:', identifier);
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    } catch (error: any) {
      console.error('CRITICAL Login error:', error);
      res.status(500).json({ error: 'Ошибка при входе: ' + (error.message || 'неизвестная ошибка') });
    }
  });

  app.get('/api/auth/me', authenticateJWT, async (req: any, res) => {
    try {
      if (req.user.role === 'owner') {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        res.json(user);
      } else {
        const client = await prisma.client.findUnique({ where: { id: req.user.id } });
        res.json(client);
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- Social Auth (Feature 7) ---
  app.post('/api/businesses', authenticateJWT, async (req: any, res) => {
    try {
      if (req.user.role !== 'owner') return res.status(403).json({ error: 'Доступ запрещен' });
      
      const { name, slug } = req.body;
      console.log('POST /api/businesses - Request from user:', req.user.id, 'Name:', name, 'Slug:', slug);

      // Check if user already has a business
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { business: true }
      });
      
      if (user?.business) {
        console.log('User already has a business, returning existing one:', user.business.slug);
        return res.json(user.business);
      }
      
      const existing = await prisma.business.findUnique({ where: { slug } });
      if (existing) return res.status(400).json({ error: 'Этот ID уже занят' });
      
      const business = await prisma.business.create({
        data: {
          name,
          slug,
          workingHours: {
            mon: { start: "10:00", end: "20:00" },
            tue: { start: "10:00", end: "20:00" },
            wed: { start: "10:00", end: "20:00" },
            thu: { start: "10:00", end: "20:00" },
            fri: { start: "10:00", end: "20:00" },
            sat: { start: "10:00", end: "18:00" },
            sun: { start: "10:00", end: "18:00" }
          }
        }
      });
      
      await prisma.user.update({
        where: { id: req.user.id },
        data: { businessId: business.id }
      });
      
      res.json(business);
    } catch (error) {
      console.error('Business creation error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/business/:slug', authenticateJWT, async (req: any, res) => {
    try {
      if (req.user.role !== 'owner') return res.status(403).json({ error: 'Доступ запрещен' });
      
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { business: true }
      });
      
      if (!user?.business || user.business.slug !== req.params.slug) {
        return res.status(404).json({ error: 'Бизнес не найден' });
      }
      
      // Delete business and related records (Prisma handles cascading if configured, but let's be safe)
      // Actually, we should just disconnect the user and delete the business
      await prisma.user.update({
        where: { id: req.user.id },
        data: { businessId: null }
      });
      
      await prisma.business.delete({
        where: { id: user.businessId! }
      });
      
      res.json({ message: 'Бизнес успешно удален' });
    } catch (error) {
      console.error('Delete business error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // API: Регистрация клиента
  app.post('/api/auth/client/register', async (req, res) => {
    try {
      const { phone: rawPhone, password, name, email } = req.body;
      const phone = normalizePhone(rawPhone);
      
      // Проверить существует ли клиент
      let client = await prisma.client.findUnique({ where: { phone } });
      
      if (client?.isRegistered) {
        return res.status(400).json({ error: 'Пользователь с таким номером уже зарегистрирован' });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      
      if (client) {
        // Клиент существует (записывался ранее без регистрации)
        // Обновляем его данные и активируем аккаунт
        client = await prisma.client.update({
          where: { phone },
          data: {
            password: hashedPassword,
            name: name || client.name,
            email: email || client.email,
            isRegistered: true
          }
        });
        
        // Получить историю визитов
        const bookingsCount = await prisma.booking.count({
          where: { clientPhone: phone }
        });
        
        const token = generateJWT(client);
        
        return res.json({
          token,
          client,
          message: bookingsCount > 0 
            ? `Добро пожаловать! Мы нашли ${bookingsCount} ваших прошлых записей.`
            : 'Регистрация успешна!'
        });
      }
      
      // Новый клиент
      client = await prisma.client.create({
        data: {
          phone,
          password: hashedPassword,
          name,
          email,
          isRegistered: true
        }
      });
      
      const token = generateJWT(client);
      
      res.json({ token, client, message: 'Регистрация успешна!' });
    } catch (error) {
      console.error("Client registration error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // API: Вход клиента
  app.post('/api/auth/client/login', async (req, res) => {
    try {
      const { phone: rawPhone, password } = req.body;
      const phone = normalizePhone(rawPhone);
      
      const client = await prisma.client.findUnique({ where: { phone } });
      
      if (!client) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      
      if (!client.isRegistered || !client.password) {
        return res.status(400).json({ 
          error: 'Аккаунт не активирован. Пожалуйста, зарегистрируйтесь.',
          needsRegistration: true
        });
      }
      
      const isValid = await bcrypt.compare(password, client.password);
      
      if (!isValid) {
        return res.status(400).json({ error: 'Неверный пароль' });
      }
      
      const token = generateJWT(client);
      
      res.json({ token, client });
    } catch (error) {
      console.error("Client login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // --- Client Profile (Feature 7) ---
  app.get('/api/clients/me', authenticateJWT, async (req: any, res) => {
    try {
      const startTime = Date.now();
      // Use Promise.all to fetch potential client and user records in parallel
      const [client, user] = await Promise.all([
        prisma.client.findUnique({ where: { id: req.user.id } }),
        prisma.user.findUnique({ where: { id: req.user.id } })
      ]);
      
      if (client) {
        // Aggregate points across matching phone/email records
        const pointsAggregation = await prisma.client.aggregate({
          where: {
            OR: [
              { phone: client.phone },
              client.email ? { email: { equals: client.email.toLowerCase() } } : { id: 'NEVER_MATCH' }
            ]
          },
          _sum: { loyaltyPoints: true }
        });

        console.log(`[Perf] /api/clients/me took ${Date.now() - startTime}ms`);
        return res.json({ 
          ...client,
          role: 'client',
          loyaltyPoints: pointsAggregation._sum.loyaltyPoints || 0
        });
      }

      if (!user) return res.status(404).json({ error: 'User/Client not found' });
      
      // Find associated client by email or phone for owner too
      const associatedClient = await prisma.client.findFirst({
        where: { 
          OR: [
            user.email ? { email: user.email } : { email: 'NEVER_MATCH' },
            user.phone ? { phone: user.phone } : { phone: 'NEVER_MATCH' },
            user.phone ? { phone: `+${user.phone}` } : { phone: 'NEVER_MATCH' }
          ]
        }
      });
      
      console.log(`[Perf] /api/clients/me (user) took ${Date.now() - startTime}ms`);
      res.json({ ...user, client: associatedClient });
    } catch (error) {
      console.error("Error fetching me:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/api/clients/me', authenticateJWT, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') return res.status(403).json({ error: 'Forbidden' });
      const client = await prisma.client.update({
        where: { id: req.user.id },
        data: req.body
      });
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/clients/me/bookings', authenticateJWT, async (req: any, res) => {
    try {
      const startTime = Date.now();
      let clientIds = [req.user.id];

      // Fetch the current client/user to find all associated client records (by phone/email)
      const [tokenClient, tokenUser] = await Promise.all([
        prisma.client.findUnique({ where: { id: req.user.id } }),
        prisma.user.findUnique({ where: { id: req.user.id } })
      ]);

      const phone = tokenClient?.phone || tokenUser?.phone;
      const email = tokenClient?.email || tokenUser?.email;

      if (phone || email) {
        const normalized = phone ? normalizePhone(phone) : null;
        const phoneSuffix = normalized && normalized.length >= 10 ? normalized.slice(-10) : null;

        const matchingClients = await prisma.client.findMany({
          where: {
            OR: [
              normalized ? { phone: normalized } : { email: 'NEVER_MATCH' },
              normalized ? { phone: `+${normalized}` } : { email: 'NEVER_MATCH' },
              phoneSuffix ? { phone: { contains: phoneSuffix } } : { email: 'NEVER_MATCH' },
              email ? { email: { equals: email.toLowerCase() } } : { phone: 'NEVER_MATCH' }
            ]
          },
          select: { id: true }
        });
        clientIds = Array.from(new Set([...clientIds, ...matchingClients.map(c => c.id)]));
      }
      
      const normalized = phone ? normalizePhone(phone) : null;
      const phoneSuffix = normalized && normalized.length >= 10 ? normalized.slice(-10) : null;
      
      const bookings = await prisma.booking.findMany({
        where: {
          OR: [
            { clientId: { in: clientIds } },
            normalized ? { clientPhone: normalized } : { clientName: 'NEVER_MATCH_XYZ' },
            normalized ? { clientPhone: `+${normalized}` } : { clientName: 'NEVER_MATCH_XYZ' },
            phoneSuffix ? { clientPhone: { contains: phoneSuffix } } : { clientName: 'NEVER_MATCH_XYZ' }
          ]
        },
        include: { 
          service: { select: { id: true, name: true, durationMinutes: true, price: true } }, 
          staff: { select: { id: true, name: true } }, 
          business: { select: { id: true, name: true, slug: true, address: true, phone: true } } 
        },
        orderBy: { startTime: 'desc' }
      });
      
      console.log(`[Perf] /api/clients/me/bookings took ${Date.now() - startTime}ms`);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching client bookings:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/clients/me/subscriptions', authenticateJWT, async (req: any, res) => {
    try {
      let clientId = req.user.id;

      if (req.user.role !== 'client') {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) {
          const client = await prisma.client.findFirst({ 
            where: { 
              OR: [
                user.email ? { email: user.email } : { email: 'NEVER_MATCH' },
                user.phone ? { phone: user.phone } : { phone: 'NEVER_MATCH' },
                user.phone ? { phone: `+${user.phone}` } : { phone: 'NEVER_MATCH' }
              ]
            } 
          });
          if (client) clientId = client.id;
          else return res.json([]);
        } else {
          return res.json([]);
        }
      }
      
      const subscriptions = await prisma.subscriptionPurchase.findMany({
        where: { clientId, expiresAt: { gt: new Date() } },
        include: { subscription: { include: { service: true } } }
      });
      res.json(subscriptions);
    } catch (error) {
      console.error("Error fetching client subscriptions:", error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/clients/telegram/link-request', authenticateJWT, async (req: any, res) => {
    try {
      let clientId = req.user.id;

      if (req.user.role !== 'client') {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (user) {
          const client = await prisma.client.findFirst({ 
            where: { 
              OR: [
                user.email ? { email: user.email } : { email: 'NEVER_MATCH' },
                user.phone ? { phone: user.phone } : { phone: 'NEVER_MATCH' },
                user.phone ? { phone: `+${user.phone}` } : { phone: 'NEVER_MATCH' }
              ]
            } 
          });
          if (client) clientId = client.id;
          else return res.status(404).json({ error: 'Client not found' });
        } else {
          return res.status(404).json({ error: 'User not found' });
        }
      }
      
      const code = Math.random().toString(36).substring(2, 10).toLowerCase();
      await prisma.telegramLinkRequest.create({
        data: { clientId, code, expiresAt: addHours(new Date(), 1) }
      });
      
      const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'Slotsmsbot';
      res.json({ botUrl: `https://t.me/${botUsername}?start=${code}` });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- Telegram (Feature 8) ---
  app.post('/api/telegram/link', async (req, res) => {
    const { clientId } = req.body;
    const code = generateRandomCode(8).toLowerCase();
    await prisma.telegramLinkRequest.create({
      data: { clientId, code, expiresAt: addHours(new Date(), 24) }
    });
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'BookBotNotifyBot';
    res.json({ linkUrl: `https://t.me/${botUsername}?start=${code}` });
  });

  // --- Rebooking (Feature 10) ---
  app.get('/api/rebook/:hash', async (req, res) => {
    const booking = await prisma.booking.findFirst({
      where: { confirmHash: req.params.hash },
      include: { service: true, staff: true, business: true, client: true }
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    
    // Suggest a similar slot in 14 days
    const suggestedSlot = await findSimilarSlot(booking.businessId, booking.staffId!, booking.serviceId, booking.startTime, 14);
    res.json({ prevBooking: booking, suggestedSlot });
  });

  app.post('/api/rebook/:hash/confirm', async (req, res) => {
    const { date, time } = req.body;
    const prevBooking = await prisma.booking.findFirst({
      where: { confirmHash: req.params.hash },
      include: { service: true, client: true }
    });
    if (!prevBooking) return res.status(404).json({ error: 'Previous booking not found' });

    const startTime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
    const endTime = addMinutes(startTime, prevBooking.service.durationMinutes);

    const newBooking = await prisma.booking.create({
      data: {
        businessId: prevBooking.businessId,
        clientId: prevBooking.clientId,
        serviceId: prevBooking.serviceId,
        staffId: prevBooking.staffId,
        startTime,
        endTime,
        clientName: prevBooking.clientName,
        clientPhone: prevBooking.clientPhone,
        totalPrice: prevBooking.service.price,
        status: 'CONFIRMED'
      }
    });

    await sendNotification(prevBooking.client, `✅ Запись подтверждена!\n${prevBooking.service.name}\n${format(startTime, 'dd MMMM в HH:mm', { locale: ru })}`);
    res.json(newBooking);
  });

  async function findSimilarSlot(businessId: string, staffId: string, serviceId: string, originalTime: Date, daysAhead: number) {
    const targetHour = originalTime.getHours();
    for (let i = daysAhead; i <= daysAhead + 14; i++) {
      const checkDate = addDays(new Date(), i);
      const slots = await getAvailableSlots(businessId, serviceId, staffId, format(checkDate, 'yyyy-MM-dd'));
      const similarSlot = slots.find(slot => {
        const slotHour = parseInt(slot.start.split(':')[0]);
        return Math.abs(slotHour - targetHour) <= 1;
      });
      if (similarSlot) return { date: checkDate, time: similarSlot.start, staffId };
    }
    return null;
  }

  // Cron Job (Feature 10)
  cron.schedule('0 10 * * *', async () => {
    const candidates = await prisma.booking.findMany({
      where: {
        status: 'COMPLETED',
        updatedAt: { gte: subDays(new Date(), 21), lte: subDays(new Date(), 14) },
        rebookReminderSent: false
      },
      include: { client: true, service: true, staff: true, business: true }
    });

    for (const booking of candidates) {
      const suggestedSlot = await findSimilarSlot(booking.businessId, booking.staffId!, booking.serviceId, booking.startTime, 14);
      if (suggestedSlot) {
        const message = `${booking.clientName}, пора обновить ${booking.service.name.toLowerCase()}! 💇\n\nМастер ${booking.staff?.name || 'ваш мастер'} свободен ${format(suggestedSlot.date, 'dd MMMM', { locale: ru })} в ${suggestedSlot.time}.\n\n✅ Записаться в 1 клик:\n${process.env.APP_URL}/rebook/${booking.confirmHash}`;
        await sendNotification(booking.client, message);
        await prisma.booking.update({ where: { id: booking.id }, data: { rebookReminderSent: true } });
      }
    }
  });

  // Инициализация категорий
  async function seedCategories() {
    const categories = [
      { name: 'Барбершопы', namePlural: 'Барбершопов', slug: 'barbershops', icon: '✂️', color: '#3B82F6', sortOrder: 1 },
      { name: 'Маникюр', namePlural: 'Студий маникюра', slug: 'manicure', icon: '💅', color: '#EC4899', sortOrder: 2 },
      { name: 'Массаж', namePlural: 'Массажных салонов', slug: 'massage', icon: '💆', color: '#10B981', sortOrder: 3 },
      { name: 'Косметология', namePlural: 'Косметологов', slug: 'cosmetology', icon: '✨', color: '#8B5CF6', sortOrder: 4 },
      { name: 'Мастерская', namePlural: 'Мастерских', slug: 'workshop', icon: '🛠️', color: '#F59E0B', sortOrder: 5 },
    ];

    console.log('Seeding marketplace categories...');
    for (const cat of categories) {
      await prisma.category.upsert({
        where: { slug: cat.slug },
        update: { ...cat },
        create: { ...cat }
      });
    }
    console.log('Categories seeded successfully');
  }

  seedCategories().catch(err => console.error('Seed categories error:', err));

  // --- Marketplace API ---
  
  // Получить все категории
  app.get('/api/marketplace/categories', async (req, res) => {
    try {
      const categories = await prisma.category.findMany({
        where: { isActive: true, parentId: null },
        include: {
          _count: {
            select: {
              businesses: {
                where: { isPublished: true }
              }
            }
          }
        },
        orderBy: { sortOrder: 'asc' }
      });
      
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: 'Ошибка получения категорий' });
    }
  });

  // Поиск бизнесов для маркетплейса
  app.get('/api/marketplace/businesses', async (req, res) => {
    try {
      const {
        lat,
        lng,
        radius = '10',
        categorySlug,
        minRating,
        maxPrice,
        query,
        sortBy = 'distance',
        page = '1',
        limit = '20',
        city
      } = req.query as Record<string, string>;
      
      // Базовый фильтр
      const where: any = {
        isPublished: true
      };
      
      // Фильтр по категории
      if (categorySlug) {
        const category = await prisma.category.findUnique({
          where: { slug: categorySlug }
        });
        if (category) {
          where.categoryId = category.id;
        }
      }
      
      // Фильтр по городу
      if (city) {
        where.city = { contains: city, mode: 'insensitive' };
      }
      
      // Текстовый поиск
      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { address: { contains: query, mode: 'insensitive' } }
        ];
      }
      
      // Получить бизнесы
      const businesses = await prisma.business.findMany({
        where,
        include: {
          category: true,
          services: {
            where: { isActive: true },
            orderBy: { price: 'asc' },
            take: 3
          },
          reviews: {
            where: { status: 'approved' },
            select: { rating: true }
          },
          _count: {
            select: {
              reviews: { where: { status: 'approved' } }
            }
          },
          posts: {
            where: { isPublished: true },
            orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
            take: 3,
            include: { _count: { select: { likes: true, comments: true } } }
          }
        }
      });
      
      // Обработать бизнесы
      let result = businesses.map(business => {
        // Средний рейтинг
        const avgRating = business.reviews.length > 0
          ? business.reviews.reduce((sum, r) => sum + r.rating, 0) / business.reviews.length
          : null;
        
        // Минимальная цена
        const minPrice = business.services.length > 0
          ? Math.min(...business.services.map(s => Number(s.price)))
          : null;
        
        // Расстояние (если переданы координаты)
        let distance = null;
        if (lat && lng && business.latitude && business.longitude) {
          distance = calculateDistance(
            parseFloat(lat),
            parseFloat(lng),
            business.latitude,
            business.longitude
          );
        }
        
        // Открыт ли сейчас
        const isOpenNow = checkIsOpenNow(business.workingHours);
        
        return {
          id: business.id,
          name: business.name,
          slug: business.slug,
          address: business.address,
          phone: business.phone,
          description: business.description,
          latitude: business.latitude,
          longitude: business.longitude,
          logo: business.logo,
          coverImage: business.coverImage,
          category: business.category,
          services: business.services.map(s => ({
            id: s.id,
            name: s.name,
            price: Number(s.price),
            durationMinutes: s.durationMinutes
          })),
          avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
          reviewCount: business._count.reviews,
          minPrice,
          distance,
          isOpenNow,
          isFeatured: business.featuredUntil 
            ? new Date(business.featuredUntil) > new Date() 
            : false,
          workingHours: business.workingHours,
          posts: business.posts.map(p => ({
            id: p.id,
            type: p.type,
            text: p.text,
            mediaUrls: p.mediaUrls,
            likesCount: p.likesCount,
            viewsCount: p.viewsCount,
            commentsCount: p._count.comments
          }))
        };
      });
      
      // Фильтр по рейтингу
      if (minRating) {
        result = result.filter(b => 
          b.avgRating !== null && b.avgRating >= parseFloat(minRating)
        );
      }
      
      // Фильтр по цене
      if (maxPrice) {
        result = result.filter(b => 
          b.minPrice !== null && b.minPrice <= parseFloat(maxPrice)
        );
      }
      
      // Фильтр по радиусу
      if (lat && lng && radius) {
        result = result.filter(b => 
          b.distance !== null && b.distance <= parseFloat(radius)
        );
      }
      
      // Сортировка
      result.sort((a, b) => {
        if (sortBy === 'rating') {
          return (b.avgRating || 0) - (a.avgRating || 0);
        }
        if (sortBy === 'price') {
          return (a.minPrice || 999999) - (b.minPrice || 999999);
        }
        if (sortBy === 'distance' && a.distance !== null && b.distance !== null) {
          // Сначала продвигаемые
          if (a.isFeatured && !b.isFeatured) return -1;
          if (!a.isFeatured && b.isFeatured) return 1;
          return a.distance - b.distance;
        }
        return 0;
      });
      
      // Пагинация
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const total = result.length;
      const paginated = result.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      
      res.json({
        businesses: paginated,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        hasMore: pageNum * limitNum < total
      });
    } catch (error) {
      console.error('[Marketplace] Ошибка:', error);
      res.status(500).json({ error: 'Ошибка поиска' });
    }
  });

  // Детали бизнеса для маркетплейса
  app.get('/api/marketplace/businesses/:slug', async (req, res) => {
    try {
      const business = await prisma.business.findUnique({
        where: { slug: req.params.slug },
        include: {
          category: true,
          services: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
          },
          staff: {
            where: { isActive: true },
            include: {
              portfolioPhotos: {
                take: 6
              }
            }
          },
          reviews: {
            where: { status: 'approved' },
            include: {
              client: {
                select: { name: true }
              }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });
      
      if (!business) {
        return res.status(404).json({ error: 'Бизнес не найден' });
      }
      
      const avgRating = business.reviews.length > 0
        ? business.reviews.reduce((sum, r) => sum + r.rating, 0) / business.reviews.length
        : null;
      
      res.json({
        ...business,
        avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
        reviewCount: business.reviews.length
      });
    } catch (error) {
      res.status(500).json({ error: 'Ошибка' });
    }
  });

  // Геокодирование адреса (через Яндекс)
  app.get('/api/geocode', async (req, res) => {
    try {
      const { address } = req.query as { address: string };
      const rawKey = process.env.YANDEX_MAPS_API_KEY || '';
      const apiKey = rawKey.trim().replace(/^['"]|['"]$/g, '');
      
      const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${apiKey}&geocode=${encodeURIComponent(address)}&format=json&results=1`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      const feature = data?.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
      
      if (!feature) {
        return res.status(404).json({ error: 'Адрес не найден' });
      }
      
      const [longitude, latitude] = feature.Point.pos.split(' ').map(Number);
      const fullAddress = feature.metaDataProperty.GeocoderMetaData.text;
      
      res.json({ latitude, longitude, address: fullAddress });
    } catch (error) {
      res.status(500).json({ error: 'Ошибка геокодирования' });
    }
  });

  // Вспомогательные функции для маркетплейса
  function calculateDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const R = 6371; // Радиус Земли в км
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  function checkIsOpenNow(workingHours: any): boolean {
    if (!workingHours) return false;
    
    const now = new Date();
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const today = days[now.getDay()];
    const hours = workingHours[today];
    
    if (!hours) return false;
    
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    return currentTime >= hours.start && currentTime <= hours.end;
  }

  // --- Business Posts (Feature: Portfolio social network) ---
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.get('/api/business/:slug/posts', async (req, res) => {
    const { page = 1, limit = 12 } = req.query;
    try {
      const business = await prisma.business.findUnique({ where: { slug: req.params.slug } });
      if (!business) return res.status(404).json({ error: 'Business not found' });

      const skip = (Number(page) - 1) * Number(limit);
      
      const posts = await prisma.businessPost.findMany({
        where: { businessId: business.id, isPublished: true },
        skip,
        take: Number(limit),
        orderBy: [
          { isPinned: 'desc' },
          { createdAt: 'desc' }
        ],
        include: { 
          author: true, 
          service: true,
          _count: { select: { likes: true, comments: true } }
        }
      });

      res.json(posts);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/posts', authenticateJWT, upload.array('files', 10), async (req: any, res) => {
    try {
      if (req.user.role !== 'owner') return res.status(403).json({ error: 'Only owners can post' });
      
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user?.businessId) return res.status(400).json({ error: 'No business associated with this user' });

      const { type, text, tags, serviceId, voiceDuration, isPublic } = req.body;
      const files = req.files as Express.Multer.File[];
      
      let mediaUrls: string[] = [];
      let voiceUrl = null;

      if (type === 'VOICE' && files.length > 0) {
        voiceUrl = `/uploads/posts/${files[0].filename}`;
      } else {
        mediaUrls = files.map(f => `/uploads/posts/${f.filename}`);
      }

      const post = await prisma.businessPost.create({
        data: {
          businessId: user.businessId,
          type,
          text,
          mediaUrls: JSON.stringify(mediaUrls),
          voiceUrl,
          voiceDuration: voiceDuration ? parseInt(voiceDuration) : null,
          tags: tags || "[]",
          serviceId: (serviceId && serviceId !== 'null' && serviceId !== '') ? serviceId : null,
          isPublished: true,
          isPublic: isPublic === 'false' || isPublic === false ? false : true
        }
      });

      res.json(post);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/posts/:id', authenticateJWT, async (req: any, res) => {
    try {
      const post = await prisma.businessPost.findUnique({ where: { id: req.params.id } });
      if (!post) return res.status(404).json({ error: 'Post not found' });
      
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (post.businessId !== user?.businessId) return res.status(403).json({ error: 'Forbidden' });

      await prisma.businessPost.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.patch('/api/posts/:id/pin', authenticateJWT, async (req: any, res) => {
    try {
      const post = await prisma.businessPost.findUnique({ where: { id: req.params.id } });
      if (!post) return res.status(404).json({ error: 'Post not found' });
      
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (post.businessId !== user?.businessId) return res.status(403).json({ error: 'Forbidden' });

      const updated = await prisma.businessPost.update({
        where: { id: req.params.id },
        data: { isPinned: !post.isPinned }
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/posts/:id/view', async (req, res) => {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    let clientId = null;
    let ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (Array.isArray(ip)) ip = ip[0];
    const ipHash = crypto.createHash('sha256').update(ip as string).digest('hex');

    if (authHeader && authHeader.split(' ')[1] && authHeader.split(' ')[1] !== 'null' && authHeader.split(' ')[1] !== 'undefined') {
      const token = authHeader.split(' ')[1];
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        if (decoded.role === 'client') clientId = decoded.id;
      } catch (e) {}
    }

    try {
      try {
        await prisma.postView.create({
          data: {
            postId: id,
            clientId,
            ipHash
          }
        });
      } catch (e: any) {
        if (e.code !== 'P2002') throw e;
      }

      const count = await prisma.postView.count({
        where: { postId: id }
      });

      const updatedPost = await prisma.businessPost.update({
        where: { id },
        data: { viewsCount: count }
      });

      res.json({ viewsCount: count, post: updatedPost });
    } catch (error) {
      console.error('View tracking error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
  });

  app.get('/api/posts/:id/likes', async (req, res) => {
    try {
      const likes = await prisma.postLike.findMany({
        where: { postId: req.params.id },
        include: { client: true },
        orderBy: { createdAt: 'desc' }
      });
      
      const result = likes.map(like => ({
        id: like.id,
        clientName: like.client ? like.client.name : 'Анонимный пользователь',
        clientPhone: like.client ? `${like.client.phone.slice(0, 4)}***${like.client.phone.slice(-4)}` : null,
        isAnonymous: !like.client,
        createdAt: like.createdAt
      }));

      res.json({ likes: result, total: result.length });
    } catch (error) {
      res.status(500).json({ error: 'Internal error' });
    }
  });

  app.post('/api/posts/:id/like', async (req: any, res) => {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    let clientId = null;
    let ipHash = crypto.createHash('md5').update(req.ip || req.connection.remoteAddress || 'unknown').digest('hex');

    if (authHeader && authHeader.split(' ')[1] && authHeader.split(' ')[1] !== 'null' && authHeader.split(' ')[1] !== 'undefined') {
      const token = authHeader.split(' ')[1];
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        if (decoded.role === 'client') clientId = decoded.id;
      } catch (e) {}
    }

    try {
      const existingLike = await prisma.postLike.findFirst({
        where: {
          postId: id,
          OR: [
            clientId ? { clientId } : { id: 'NEVER' },
            { ipHash }
          ]
        }
      });

      if (existingLike) {
        await prisma.postLike.delete({ where: { id: existingLike.id } });
        await prisma.businessPost.update({ where: { id }, data: { likesCount: { decrement: 1 } } });
        res.json({ liked: false });
      } else {
        await prisma.postLike.create({
          data: { postId: id, clientId, ipHash }
        });
        await prisma.businessPost.update({ where: { id }, data: { likesCount: { increment: 1 } } });
        res.json({ liked: true });
      }
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/posts/:id/comments', async (req, res) => {
    try {
      const comments = await prisma.postComment.findMany({
        where: { postId: req.params.id, isVisible: true },
        include: { client: true },
        orderBy: { createdAt: 'asc' }
      });
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/posts/:id/comments', authenticateJWT, async (req: any, res) => {
    const { text } = req.body;
    try {
      if (req.user.role !== 'client') return res.status(403).json({ error: 'Only clients can comment' });
      
      const comment = await prisma.postComment.create({
        data: {
          postId: req.params.id,
          clientId: req.user.id,
          text
        },
        include: { client: true }
      });
      res.json(comment);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/posts/:postId/comments/:commentId', authenticateJWT, async (req: any, res) => {
    try {
      const { postId, commentId } = req.params;
      const post = await prisma.businessPost.findUnique({
        where: { id: postId },
        select: { businessId: true }
      });
      
      if (!post) return res.status(404).json({ error: 'Post not found' });
      
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      
      if (req.user.role !== 'owner' || post.businessId !== user?.businessId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- SOCIAL SYSTEM: FOLLOWS ---
  app.post('/api/follow', authenticateJWT, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') return res.status(403).json({ error: 'Only clients can follow' });
      const { businessId } = req.body;
      const follow = await prisma.follow.upsert({
        where: { clientId_businessId: { clientId: req.user.id, businessId } },
        create: { clientId: req.user.id, businessId },
        update: {}
      });
      res.json(follow);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/follow/:businessId', authenticateJWT, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') return res.status(403).json({ error: 'Only clients can unfollow' });
      await prisma.follow.deleteMany({
        where: { clientId: req.user.id, businessId: req.params.businessId }
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/following', authenticateJWT, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') return res.status(403).json({ error: 'Forbidden' });
      const following = await prisma.follow.findMany({
        where: { clientId: req.user.id },
        include: { business: true }
      });
      res.json(following.map(f => f.business));
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/business/:id/followers', async (req, res) => {
    try {
      const { id } = req.params;
      const count = await prisma.follow.count({ where: { businessId: id } });
      const topFollowers = await prisma.follow.findMany({
        where: { businessId: id },
        take: 5,
        include: { client: { select: { name: true, phone: true } } }
      });
      res.json({ count, topFollowers });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- SOCIAL SYSTEM: RECOMMENDATIONS ---
  app.post('/api/recommend', authenticateJWT, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') return res.status(403).json({ error: 'Only clients can recommend' });
      const { businessId } = req.body;
      const recommendation = await prisma.businessRecommendation.upsert({
        where: { clientId_businessId: { clientId: req.user.id, businessId } },
        create: { clientId: req.user.id, businessId },
        update: {}
      });
      res.json(recommendation);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/recommend/:businessId', authenticateJWT, async (req: any, res) => {
    try {
      if (req.user.role !== 'client') return res.status(403).json({ error: 'Forbidden' });
      await prisma.businessRecommendation.deleteMany({
        where: { clientId: req.user.id, businessId: req.params.businessId }
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/business/:id/recommendations', async (req, res) => {
    try {
      const { id } = req.params;
      const recommendations = await prisma.businessRecommendation.findMany({
        where: { businessId: id },
        include: { client: { select: { name: true, phone: true } } }
      });
      res.json(recommendations);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- REFERRAL SYSTEM ---
  app.post('/api/referral/create', authenticateJWT, async (req: any, res) => {
    try {
      const { businessId } = req.body;
      if (!businessId) return res.status(400).json({ error: 'BusinessId is required' });
      
      const clientId = req.user.id;
      
      let refLink = await prisma.referralLink.findFirst({
        where: { clientId, businessId }
      });

      if (!refLink) {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        refLink = await prisma.referralLink.create({
          data: { code, clientId, businessId }
        });
      }

      res.json(refLink);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/referral/:code', async (req, res) => {
    try {
      const { code } = req.params;
      const refLink = await prisma.referralLink.findUnique({
        where: { code },
        include: { 
          client: { select: { name: true } }, 
          business: { select: { name: true, slug: true, isReferralEnabled: true, referralRewardPercent: true } } 
        }
      });

      if (!refLink) return res.status(404).json({ error: 'Referral link not found' });

      // Track visit
      await prisma.referralVisit.create({
        data: { referralId: refLink.id }
      });

      res.json(refLink);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/referral/apply', async (req, res) => {
    const { code } = req.body;
    res.json({ success: true, code });
  });

  // --- GLOBAL FEED ---
  app.get('/api/feed', async (req, res) => {
    try {
      const { city, category, page = 1, limit = 20, sort = 'newest' } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      
      const where: any = {
        isPublic: true,
        isPublished: true,
      };

      if (city || category) {
        where.business = {};
        if (city) where.business.city = city;
        if (category) {
          where.business.category = { slug: category };
        }
      }

      const posts = await prisma.businessPost.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: sort === 'liked' ? { likesCount: 'desc' } : { createdAt: 'desc' },
        include: {
          business: { include: { category: true } },
          _count: { select: { likes: true, comments: true } }
        }
      });

      res.json(posts);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // --- Vite Middleware ---

  if (process.env.NODE_ENV !== "production") {
    try {
      console.log("Initializing Vite server...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite server initialized.");
    } catch (e) {
      console.error("Failed to configure Vite middleware:", e);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    await prisma.$disconnect();
    if (redis) await redis.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
