#!/usr/bin/env node

import { db } from '../db/index.js';
import { botSettings } from '../shared/schema.js';
import { setupBot } from '../server/bot.js';
import { eq } from 'drizzle-orm';

async function restartBot() {
  try {
    console.log('Перезапуск Telegram бота...');
    
    // Получаем настройки бота
    const settings = await db.query.botSettings.findFirst({
      where: eq(botSettings.key, 'telegram_token')
    });
    
    if (!settings || !settings.value) {
      throw new Error('Не найден токен Telegram бота в настройках. Используйте TELEGRAM_BOT_TOKEN из переменных окружения.');
    }
    
    const token = process.env.TELEGRAM_BOT_TOKEN || (settings.value as any).token;
    
    if (!token) {
      throw new Error('Токен Telegram бота не найден. Убедитесь, что переменная окружения TELEGRAM_BOT_TOKEN задана или токен сохранен в базе данных.');
    }
    
    // Перезапускаем бота
    const bot = setupBot(token);
    
    if (!bot) {
      throw new Error('Не удалось запустить бота.');
    }
    
    console.log('Бот успешно перезапущен!');
    
    // Сохраняем токен в базе данных, если его там еще нет
    if (!settings) {
      await db.insert(botSettings).values({
        key: 'telegram_token',
        value: { token }
      });
    } else if (token !== (settings.value as any).token) {
      await db.update(botSettings)
        .set({ value: { token } })
        .where(eq(botSettings.key, 'telegram_token'));
    }
    
  } catch (error) {
    console.error('Ошибка при перезапуске бота:', error);
    process.exit(1);
  }
}

// Запускаем функцию перезапуска бота
restartBot().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Неожиданная ошибка:', error);
  process.exit(1);
});
