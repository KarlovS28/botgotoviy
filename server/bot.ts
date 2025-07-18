import { Telegraf, Scenes, session } from "telegraf";
import { message } from 'telegraf/filters';
import { storage } from "./storage";
import * as schema from "@shared/schema";
import { db } from "../db";
import { eq, and, or } from "drizzle-orm";

// Initialize the bot with null initially
export let telegramBot: Telegraf | null = null;

/**
 * Setup the Telegram bot with the given token
 */
export function setupBot(token: string) {
  try {
    // Close existing bot if any
    if (telegramBot) {
      telegramBot.stop();
    }

    // Create a new bot instance
    const bot = new Telegraf(token);

    // Set up middleware
    bot.use(session());

    // Bot command handlers
    setupBotHandlers(bot);

    // Start the bot
    bot.launch();

    // Store the bot globally
    telegramBot = bot;

    console.log("Telegram bot started successfully");

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

    return bot;
  } catch (error) {
    console.error("Failed to start Telegram bot:", error);
    return null;
  }
}

/**
 * Setup all bot command handlers
 */
function setupBotHandlers(bot: Telegraf) {
  // Start command - begins registration
  bot.start(async (ctx) => {
    const telegramId = ctx.from.id.toString();

    // Check if user already exists
    const existingUser = await storage.getUserByTelegramId(telegramId);

    if (existingUser && existingUser.isRegistered) {
      // Welcome back message
      await ctx.reply(`Добро пожаловать назад, ${existingUser.firstName || existingUser.username}!`);
      sendMainMenu(ctx, existingUser);
    } else {
      // Get welcome message from settings
      const settings = await storage.getBotSettings();
      const welcomeMessage = settings?.welcomeMessage || 
        "Добро пожаловать в бота управления имуществом, паролями и задачами. Выберите роль, чтобы продолжить.";

      // Start registration
      await ctx.reply(welcomeMessage);

      // Ask for role selection
      await askForRole(ctx);
    }
  });

  // Role selection handler
  bot.hears(['СисАдмин', 'Бухгалтер', 'Руководитель', 'Сотрудник'], async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const roleText = ctx.message.text;

    // Map role text to enum
    const roleMap: Record<string, schema.Role> = {
      'СисАдмин': schema.ROLES.SYSADMIN,
      'Бухгалтер': schema.ROLES.ACCOUNTANT,
      'Руководитель': schema.ROLES.MANAGER,
      'Сотрудник': schema.ROLES.EMPLOYEE
    };

    const role = roleMap[roleText];

    if (!role) {
      return ctx.reply('Пожалуйста, выберите роль из предложенных вариантов.');
    }

    // Check if user exists
    let user = await storage.getUserByTelegramId(telegramId);

    if (user && user.isRegistered) {
      // Prevent changing role after registration
      return ctx.reply('Вы уже зарегистрированы. Нельзя менять роль после регистрации. Используйте /start чтобы вернуться в меню.');
    } else if (user) {
      // Update existing user
      user = await storage.updateUserRole(user.id, role);
    } else {
      // Create new user
      const userData: schema.InsertUser = {
        telegramId,
        username: ctx.from.username || undefined,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name || undefined,
        role,
        isRegistered: true
      };

      user = await storage.createUser(userData);
    }

    // Set default permissions based on role
    await setDefaultPermissions(user.id, role);

    await ctx.reply(`Вы зарегистрированы как ${roleText}!`);

    // Refresh user data with permissions
    user = await storage.getUserByTelegramId(telegramId);

    // Show main menu
    if (user) {
      sendMainMenu(ctx, user);
    }
  });

  // Add a logout command
  bot.command('logout', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);

    if (!user || !user.isRegistered) {
      return ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    }

    try {
      // Unregister the user
      await db.update(schema.users)
        .set({ isRegistered: false })
        .where(eq(schema.users.telegramId, telegramId));

      // You can optionally remove permissions too
      if (user.id) {
        const userPermissions = await db.query.permissions.findMany({
          where: eq(schema.permissions.userId, user.id)
        });

        for (const permission of userPermissions) {
          await db.update(schema.permissions)
            .set({ hasAccess: false })
            .where(eq(schema.permissions.id, permission.id));
        }
      }

      await ctx.reply('Вы успешно вышли из системы. Для повторной регистрации используйте /start');
    } catch (error) {
      console.error('Error during logout:', error);
      await ctx.reply('Произошла ошибка при выходе из системы. Пожалуйста, попробуйте еще раз.');
    }
  });

  // Exit command
  bot.command('exit', async (ctx) => {
    const telegramId = ctx.from.id.toString();

    // Get user
    const user = await storage.getUserByTelegramId(telegramId);

    if (user) {
      try {
        // First delete associated records
        await db.delete(schema.securePasswords)
          .where(or(
            eq(schema.securePasswords.senderId, user.id),
            eq(schema.securePasswords.receiverId, user.id)
          ));

        await db.delete(schema.tasks)
          .where(or(
            eq(schema.tasks.createdByUserId, user.id),
            eq(schema.tasks.assignedToUserId, user.id)
          ));

        await db.delete(schema.equipmentHistory)
          .where(eq(schema.equipmentHistory.userId, user.id));

        // Then delete the user
        await storage.deleteUser(user.id);

        await ctx.reply('Вы успешно вышли из системы. Ваши данные удалены. Для повторной регистрации используйте /start');
      } catch (error) {
        console.error('Error during user deletion:', error);
        await ctx.reply('Произошла ошибка при удалении ваших данных. Пожалуйста, попробуйте еще раз.');
      }
    } else {
      await ctx.reply('Вы не зарегистрированы в системе.');
    }
  });

  // Help command
  bot.command('help', async (ctx) => {
    const helpMessage = 
      'Доступные команды:\n\n' +
      '/start - Начать работу с ботом или вернуться в главное меню\n' +
      '/inventory - Поиск информации об имуществе\n' +
      '/tasks - Управление задачами\n' +
      '/passwords - Безопасные пароли\n' +
      '/help - Показать эту справку\n' +
      '/logout - Выйти из системы (позволяет заново выбрать роль)\n' +
      '/exit - Выйти из системы и удалить свои данные';

    await ctx.reply(helpMessage);
  });

  // Inventory command
  bot.command('inventory', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    }

    // Check permissions
    const hasAccess = user.permissions.some(p => 
      p.chatType === schema.CHAT_TYPES.EQUIPMENT && p.hasAccess
    );

    if (!hasAccess) {
      return ctx.reply('У вас нет доступа к этому разделу.');
    }

    await ctx.reply(
      'Управление имуществом\n\n' +
      'Для поиска имущества по инвентарному номеру используйте команду:\n' +
      '/inventory_number <номер>\n\n' +
      'Для поиска имущества по имени сотрудника используйте команду:\n' +
      '/inventory_user <имя_или_фамилия>'
    );
  });

  // Inventory search by number
  bot.command('inventory_number', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    }

    // Check permissions
    const hasAccess = user.permissions.some(p => 
      p.chatType === schema.CHAT_TYPES.EQUIPMENT && p.hasAccess
    );

    if (!hasAccess) {
      return ctx.reply('У вас нет доступа к этому разделу.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply('Пожалуйста, укажите инвентарный номер. Например: /inventory_number T-2022-001');
    }

    const inventoryNumber = args.slice(1).join(' ');
    const equipment = await storage.getEquipment(inventoryNumber, undefined);

    if (!equipment || equipment.length === 0) {
      return ctx.reply(`Упс, походу такого нет. Имущество с инвентарным номером "${inventoryNumber}" не найдено.`);
    }

    // Display results in a tabular format
    let response = `Найдено имущество по номеру "${inventoryNumber}":\n\n`;
    response += `Дата установки | ФИО | Наименование имущества | Инвентарный номер\n`;
    response += `----------------------------------------------------------\n`;

    for (const item of equipment) {
      const assignedTo = item.assignedUser 
        ? `${item.assignedUser.lastName} ${item.assignedUser.firstName}` 
        : 'Не назначено';

      // Use item.createdAt as installation date (or updatedAt if it changed owner)
      const installDate = new Date(item.updatedAt || item.createdAt).toLocaleDateString('ru-RU');

      response += `${installDate} | ${assignedTo} | ${item.name} | ${item.inventoryNumber}\n`;
    }

    // Add a note about status
    response += `\n\nСтатус: ${equipmentStatusToRussian(equipment[0].status)}`;


    await ctx.reply(response);
  });

  // Inventory search by user
  bot.command('inventory_user', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    }

    // Check permissions
    const hasAccess = user.permissions.some(p => 
      p.chatType === schema.CHAT_TYPES.EQUIPMENT && p.hasAccess
    );

    if (!hasAccess) {
      return ctx.reply('У вас нет доступа к этому разделу.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply('Пожалуйста, укажите имя или фамилию сотрудника. Например: /inventory_user Иванов');
    }

    const employeeName = args.slice(1).join(' ');
    const equipment = await storage.getEquipment(undefined, employeeName);

    if (!equipment || equipment.length === 0) {
      return ctx.reply(`Упс, походу такого нет. Имущество, закрепленное за сотрудником "${employeeName}", не найдено.`);
    }

    // Display results in a tabular format
    let response = `Найдено имущество, закрепленное за сотрудником "${employeeName}":\n\n`;
    response += `Дата установки | ФИО | Наименование имущества | Инвентарный номер\n`;
    response += `----------------------------------------------------------\n`;

    for (const item of equipment) {
      const assignedTo = item.assignedUser 
        ? `${item.assignedUser.lastName} ${item.assignedUser.firstName}` 
        : 'Не назначено';

      // Use item.createdAt as installation date (or updatedAt if it changed owner)
      const installDate = new Date(item.updatedAt || item.createdAt).toLocaleDateString('ru-RU');

      response += `${installDate} | ${assignedTo} | ${item.name} | ${item.inventoryNumber}\n`;
    }

    // Add a note about status if all items have the same status
    if (equipment.length > 0) {
      response += `\n\nСтатус: ${equipmentStatusToRussian(equipment[0].status)}`;
    }

    await ctx.reply(response);
  });

  // Tasks command
  bot.command('tasks', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    }

    // Check permissions
    const hasAccess = user.permissions.some(p => 
      p.chatType === schema.CHAT_TYPES.TASKS && p.hasAccess
    );

    if (!hasAccess) {
      return ctx.reply('У вас нет доступа к этому разделу.');
    }

    // For SysAdmin, show assigned tasks
    if (user.role === schema.ROLES.SYSADMIN) {
      const tasks = await storage.getTasks();
      const assignedTasks = tasks.filter(t => t.assignedToUserId === user.id);

      if (assignedTasks.length === 0) {
        return ctx.reply('У вас нет назначенных задач.');
      }

      let response = 'Ваши задачи:\n\n';

      for (const task of assignedTasks) {
        const creator = task.createdBy 
          ? `${task.createdBy.lastName} ${task.createdBy.firstName}` 
          : 'Неизвестно';

        response += `🔤 Заголовок: ${task.title}\n` +
                    `📝 Описание: ${task.description || 'Нет описания'}\n` +
                    `👤 От: ${creator}\n` +
                    `🔄 Статус: ${taskStatusToRussian(task.status)}\n` +
                    `⏰ Создано: ${new Date(task.createdAt).toLocaleString('ru-RU')}\n\n`;
      }

      await ctx.reply(response);
    } else {
      // For other users, show info about creating tasks
      await ctx.reply(
        'Управление задачами\n\n' +
        'Для создания новой задачи используйте команду:\n' +
        '/new_task <название> | <описание> | <сисадмин>?\n\n' +
        'Например:\n' +
        '/new_task Настройка VPN | Настроить VPN на новом ноутбуке | @ivanov_p'
      );
    }
  });

  // New task command
  bot.command('new_task', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    }

    // Check permissions
    const hasAccess = user.permissions.some(p => 
      p.chatType === schema.CHAT_TYPES.TASKS && p.hasAccess
    );

    if (!hasAccess) {
      return ctx.reply('У вас нет доступа к этому разделу.');
    }

    const text = ctx.message.text.substring('/new_task'.length).trim();
    const parts = text.split('|').map(part => part.trim());

    if (parts.length < 2) {
      return ctx.reply('Неверный формат команды. Используйте: /new_task <название> | <описание> | <сисадмин>?');
    }

    const title = parts[0];
    const description = parts[1];
    const assigneeName = parts[2] || null;

    // Find assignee if specified
    let assigneeId = null;

    if (assigneeName) {
      // Remove @ if present
      const username = assigneeName.startsWith('@') ? assigneeName.substring(1) : assigneeName;

      // Find sysadmin with this username
      const sysadmins = await db.query.users.findMany({
        where: and(
          eq(schema.users.role, schema.ROLES.SYSADMIN),
          eq(schema.users.username, username)
        )
      });

      if (sysadmins.length > 0) {
        assigneeId = sysadmins[0].id;
      } else {
        await ctx.reply(`Системный администратор с именем ${assigneeName} не найден. Задача будет создана без назначения.`);
      }
    }

    // Create task
    const task = await storage.createTask({
      title,
      description,
      createdByUserId: user.id,
      assignedToUserId: assigneeId,
      status: assigneeId ? schema.TASK_STATUS.IN_PROGRESS : schema.TASK_STATUS.NEW
    });

    await ctx.reply(`Задача "${title}" успешно создана!`);

    // Notify assignee if applicable
    if (task.assignedToUserId && telegramBot) {
      const assignee = await storage.getUserById(task.assignedToUserId);

      if (assignee && assignee.telegramId) {
        const message = `📝 Вам назначена новая задача!\n\nЗаголовок: ${task.title}\nОписание: ${task.description}\nСтатус: ${taskStatusToRussian(task.status)}\nОт: ${user.lastName} ${user.firstName}`;

        telegramBot.telegram.sendMessage(assignee.telegramId, message)
          .catch(err => console.error("Failed to send task notification:", err));
      }
    }
  });

  // Passwords command
  bot.command('passwords', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    }

    // Check permissions
    const hasAccess = user.permissions.some(p => 
      p.chatType === schema.CHAT_TYPES.PASSWORDS && p.hasAccess
    );

    if (!hasAccess) {
      return ctx.reply('У вас нет доступа к этому разделу.');
    }

    // Show user's passwords
    const passwords = await storage.getUserSecurePasswords(user.id);

    if (passwords.length === 0) {
      return ctx.reply(
        'У вас нет безопасных паролей.\n\n' +
        'Для отправки защищенной информации используйте команду:\n' +
        '/send_password <получатель> | <название> | <тип> | <содержимое>\n\n' +
        'Например:\n' +
        '/send_password @ivanov_p | Доступ к админке | credentials | Логин: admin, Пароль: 12345'
      );
    }

    let response = 'Ваши безопасные пароли:\n\n';

    for (const password of passwords) {
      const sender = password.sender.id === user.id ? 'Вы' : `${password.sender.lastName} ${password.sender.firstName}`;
      const receiver = password.receiver.id === user.id ? 'Вам' : `${password.receiver.lastName} ${password.receiver.firstName}`;

      response += `🔒 ${password.title}\n` +
                  `📋 Тип: ${securePasswordTypeToRussian(password.type)}\n` +
                  `👤 От: ${sender}\n` +
                  `👥 Кому: ${receiver}\n` +
                  `⏰ Создано: ${new Date(password.createdAt).toLocaleString('ru-RU')}\n` +
                  `🔍 Для просмотра используйте команду: /password ${password.id}\n\n`;
    }

    await ctx.reply(response);
  });

  // View password command
  bot.command('password', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    }

    // Check permissions
    const hasAccess = user.permissions.some(p => 
      p.chatType === schema.CHAT_TYPES.PASSWORDS && p.hasAccess
    );

    if (!hasAccess) {
      return ctx.reply('У вас нет доступа к этому разделу.');
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply('Пожалуйста, укажите ID пароля. Например: /password 123');
    }

    const passwordId = parseInt(args[1], 10);

    if (isNaN(passwordId)) {
      return ctx.reply('Неверный формат ID пароля.');
    }

    const password = await storage.getSecurePasswordById(passwordId);

    if (!password) {
      return ctx.reply('Пароль не найден.');
    }

    // Check if user is sender or receiver
    if (password.senderId !== user.id && password.receiverId !== user.id) {
      return ctx.reply('У вас нет доступа к этому паролю.');
    }

    // Mark as read if user is receiver
    if (password.receiverId === user.id && !password.isRead) {
      await storage.markPasswordAsRead(password.id);
    }

    // Display password
    const sender = password.sender.id === user.id ? 'Вы' : `${password.sender.lastName} ${password.sender.firstName}`;
    const receiver = password.receiver.id === user.id ? 'Вам' : `${password.receiver.lastName} ${password.receiver.firstName}`;

    const response = `🔒 ${password.title}\n` +
                    `📋 Тип: ${securePasswordTypeToRussian(password.type)}\n` +
                    `👤 От: ${sender}\n` +
                    `👥 Кому: ${receiver}\n` +
                    `⏰ Создано: ${new Date(password.createdAt).toLocaleString('ru-RU')}\n` +
                    `📝 Содержимое:\n\n${password.encryptedContent}`;

    await ctx.reply(response);
  });

  // Send password command
  bot.command('send_password', async (ctx) => {
    const telegramId = ctx.from.id.toString();
    const user = await storage.getUserByTelegramId(telegramId);

    if (!user) {
      return ctx.reply('Вы не зарегистрированы. Используйте /start для регистрации.');
    }

    // Check permissions
    const hasAccess = user.permissions.some(p => 
      p.chatType === schema.CHAT_TYPES.PASSWORDS && p.hasAccess
    );

    if (!hasAccess) {
      return ctx.reply('У вас нет доступа к этому разделу.');
    }

    const text = ctx.message.text.substring('/send_password'.length).trim();
    const parts = text.split('|').map(part => part.trim());

    if (parts.length < 4) {
      return ctx.reply('Неверный формат команды. Используйте: /send_password <получатель> | <название> | <тип> | <содержимое>');
    }

    const receiverName = parts[0];
    const title = parts[1];
    const type = parts[2];
    const content = parts[3];

    // Find receiver
    const username = receiverName.startsWith('@') ? receiverName.substring(1) : receiverName;

    const receivers = await db.query.users.findMany({
      where: eq(schema.users.username, username),
      with: {
        permissions: true
      }
    });

    if (receivers.length === 0) {
      return ctx.reply(`Пользователь ${receiverName} не найден.`);
    }

    const receiver = receivers[0];

    // Check if receiver has passwords permission
    const receiverHasAccess = receiver.permissions.some(p => 
      p.chatType === schema.CHAT_TYPES.PASSWORDS && p.hasAccess
    );

    if (!receiverHasAccess) {
      return ctx.reply(`Пользователь ${receiverName} не имеет доступа к разделу паролей.`);
    }

    // Create password
    const password = await storage.createSecurePassword({
      senderId: user.id,
      receiverId: receiver.id,
      title,
      type,
      encryptedContent: content
    });

    await ctx.reply(`Защищенная информация "${title}" успешно отправлена пользователю ${receiver.firstName} ${receiver.lastName}!`);

    // Notify receiver
    if (telegramBot && receiver.telegramId) {
      const message = `🔐 Новая защищенная информация!\n\nОт: ${user.lastName} ${user.firstName}\nНазвание: ${title}\nТип: ${securePasswordTypeToRussian(type)}\n\nДля просмотра содержимого используйте команду /password ${password.id}`;

      telegramBot.telegram.sendMessage(receiver.telegramId, message)
        .catch(err => console.error("Failed to send secure password notification:", err));
    }
  });

  // Handle unknown commands
  bot.on(message('text'), async (ctx) => {
    if (ctx.message.text.startsWith('/')) {
      await ctx.reply('Неизвестная команда. Используйте /help для получения списка доступных команд.');
    }
  });
}

/**
 * Send main menu based on user permissions
 */
async function sendMainMenu(ctx: any, user: any) {
  if (!user || !user.permissions) {
    return ctx.reply('Ошибка при получении данных пользователя. Пожалуйста, свяжитесь с администратором.');
  }

  const buttons = [];

  // Check permissions for each chat type
  const equipmentAccess = user.permissions.some(p => 
    p.chatType === schema.CHAT_TYPES.EQUIPMENT && p.hasAccess
  );

  const passwordsAccess = user.permissions.some(p => 
    p.chatType === schema.CHAT_TYPES.PASSWORDS && p.hasAccess
  );

  const tasksAccess = user.permissions.some(p => 
    p.chatType === schema.CHAT_TYPES.TASKS && p.hasAccess
  );

  let message = `Главное меню\n\nВаша роль: ${roleToRussian(user.role)}\n\nДоступные разделы:\n`;

  if (equipmentAccess) {
    message += '\n📦 Мат.ответственность и склад - /inventory';
  }

  if (passwordsAccess) {
    message += '\n🔑 Безопасные пароли - /passwords';
  }

  if (tasksAccess) {
    message += '\n📝 Управление задачами - /tasks';
  }

  message += '\n\nДругие команды:\n/help - Показать справку\n/exit - Выйти из системы';

  await ctx.reply(message);
}

/**
 * Ask user to select a role
 */
async function askForRole(ctx: any) {
  await ctx.reply('Пожалуйста, выберите вашу роль:', {
    reply_markup: {
      keyboard: [
        ['СисАдмин', 'Бухгалтер'],
        ['Руководитель', 'Сотрудник']
      ],
      one_time_keyboard: true,
      resize_keyboard: true
    }
  });
}

/**
 * Set default permissions based on role
 */
async function setDefaultPermissions(userId: number, role: schema.Role) {
  const permissionsToSet: Record<string, boolean> = {
    [schema.CHAT_TYPES.EQUIPMENT]: false,
    [schema.CHAT_TYPES.PASSWORDS]: false,
    [schema.CHAT_TYPES.TASKS]: false
  };

  // Set permissions based on role
  switch (role) {
    case schema.ROLES.SYSADMIN:
      // SysAdmin has access to all
      permissionsToSet[schema.CHAT_TYPES.EQUIPMENT] = true;
      permissionsToSet[schema.CHAT_TYPES.PASSWORDS] = true;
      permissionsToSet[schema.CHAT_TYPES.TASKS] = true;
      break;
    case schema.ROLES.ACCOUNTANT:
      // Accountant has access to equipment only
      permissionsToSet[schema.CHAT_TYPES.EQUIPMENT] = true;
      break;
    case schema.ROLES.MANAGER:
      // Manager has access to passwords and tasks
      permissionsToSet[schema.CHAT_TYPES.PASSWORDS] = true;
      permissionsToSet[schema.CHAT_TYPES.TASKS] = true;
      break;
    case schema.ROLES.EMPLOYEE:
      // Employee has access to tasks only
      permissionsToSet[schema.CHAT_TYPES.TASKS] = true;
      break;
  }

  // Update permissions
  await storage.updateUserPermissions(userId, permissionsToSet);
}

/**
 * Helper functions for translating to Russian
 */
function roleToRussian(role: string): string {
  const translations: Record<string, string> = {
    [schema.ROLES.SYSADMIN]: "Системный Администратор",
    [schema.ROLES.ACCOUNTANT]: "Бухгалтер",
    [schema.ROLES.MANAGER]: "Руководитель",
    [schema.ROLES.EMPLOYEE]: "Сотрудник",
    [schema.ROLES.ADMIN]: "Администратор"
  };

  return translations[role] || role;
}

function taskStatusToRussian(status: string): string {
  const translations: Record<string, string> = {
    [schema.TASK_STATUS.NEW]: "Новая",
    [schema.TASK_STATUS.IN_PROGRESS]: "В процессе",
    [schema.TASK_STATUS.COMPLETED]: "Выполнено",
    [schema.TASK_STATUS.URGENT]: "Срочно"
  };

  return translations[status] || status;
}

function equipmentStatusToRussian(status: string): string {
  const translations: Record<string, string> = {
    [schema.EQUIPMENT_STATUS.ACTIVE]: "Активно",
    [schema.EQUIPMENT_STATUS.STORAGE]: "На складе",
    [schema.EQUIPMENT_STATUS.REPAIR]: "На ремонте",
    [schema.EQUIPMENT_STATUS.DECOMMISSIONED]: "Списано"
  };

  return translations[status] || status;
}

function securePasswordTypeToRussian(type: string): string {
  const translations: Record<string, string> = {
    "credentials": "Учетные данные",
    "password": "Пароль",
    "api_key": "API ключ",
    "other": "Другое"
  };

  return translations[type] || type;
}