#!/usr/bin/env node

import { db } from '../db/index.js';
import { users, permissions, ROLES, CHAT_TYPES } from '../shared/schema.js';
import { eq } from 'drizzle-orm';
import readline from 'readline';
import crypto from 'crypto';

// Настройка интерфейса командной строки
const args = process.argv.slice(2);
let username = '';
let password = '';
let domain = 'sysadminbotuchot.ru';

// Парсинг аргументов командной строки
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--username=')) {
    username = args[i].split('=')[1];
  } else if (args[i].startsWith('--password=')) {
    password = args[i].split('=')[1];
  } else if (args[i].startsWith('--domain=')) {
    domain = args[i].split('=')[1];
  }
}

// Если имя пользователя или пароль не указаны, запрашиваем их
if (!username || !password) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  if (!username) {
    await new Promise<void>((resolve) => {
      rl.question('Введите имя пользователя: ', (answer) => {
        username = answer;
        resolve();
      });
    });
  }

  if (!password) {
    await new Promise<void>((resolve) => {
      rl.question('Введите пароль: ', (answer) => {
        password = answer;
        resolve();
      });
    });
  }

  rl.close();
}

// Проверка наличия имени пользователя и пароля
if (!username || !password) {
  console.error('Ошибка: Необходимо указать имя пользователя и пароль');
  process.exit(1);
}

async function createAdminUser() {
  try {
    // Проверяем, существует ли пользователь с таким telegramId
    const existingUser = await db.query.users.findFirst({
      where: eq(users.telegramId, username)
    });

    if (existingUser) {
      console.log(`Пользователь с именем ${username} уже существует. Обновляем права доступа.`);
      
      // Обновляем роль пользователя на ADMIN
      await db.update(users)
        .set({ role: ROLES.ADMIN, isAdmin: true })
        .where(eq(users.telegramId, username));

      // Получаем обновленного пользователя
      const updatedUser = await db.query.users.findFirst({
        where: eq(users.telegramId, username)
      });

      if (!updatedUser) {
        throw new Error('Ошибка при обновлении пользователя');
      }

      // Обновляем права доступа
      await updatePermissions(updatedUser.id);
      
      console.log(`Пользователь ${username} обновлен до статуса администратора.`);
      console.log(`Домен для административной панели: ${domain}`);
      return;
    }

    // Хешируем пароль
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    
    // Создаем нового пользователя
    const [newUser] = await db.insert(users).values({
      telegramId: username,
      username: username,
      firstName: 'Admin',
      lastName: 'User',
      role: ROLES.ADMIN,
      isAdmin: true,
      isRegistered: true
    }).returning();

    // Добавляем права доступа
    await updatePermissions(newUser.id);

    console.log(`Администратор ${username} успешно создан.`);
    console.log(`Домен для административной панели: ${domain}`);
    console.log(`Сохраните эти данные в надежном месте!`);
  } catch (error) {
    console.error('Ошибка при создании администратора:', error);
    process.exit(1);
  }
}

async function updatePermissions(userId: number) {
  // Даем пользователю все права доступа
  for (const chatType of Object.values(CHAT_TYPES)) {
    // Проверяем, существуют ли уже права для этого типа чата
    const existingPermission = await db.query.permissions.findFirst({
      where: (permission) => {
        return eq(permission.userId, userId) && eq(permission.chatType, chatType);
      }
    });

    if (existingPermission) {
      // Обновляем существующие права
      await db.update(permissions)
        .set({ hasAccess: true })
        .where(eq(permissions.id, existingPermission.id));
    } else {
      // Создаем новые права
      await db.insert(permissions).values({
        userId,
        chatType,
        hasAccess: true
      });
    }
  }
}

// Запускаем функцию создания администратора
createAdminUser().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Неожиданная ошибка:', error);
  process.exit(1);
});
