import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { telegramBot, setupBot } from "./bot";
import { authMiddleware } from "./middlewares/auth";
import { eq, desc, and, isNull } from "drizzle-orm";
import * as schema from "@shared/schema";
import { db } from "@db";
import * as crypto from "crypto";
import * as XLSX from 'xlsx';
import fileUpload from 'express-fileupload';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Enable file upload middleware
  app.use(fileUpload());

  // Initialize Telegram bot if there's a token
  try {
    const settings = await storage.getBotSettings();
    if (settings?.botToken) {
      setupBot(settings.botToken);
    }
  } catch (error) {
    console.error("Failed to initialize Telegram bot:", error);
  }

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Имя пользователя и пароль обязательны" });
      }

      // Check for default admin credentials
      if (username === "admin" && password === "admin123") {
        // Find the admin user in database
        const adminUser = await db.query.users.findFirst({
          where: and(
              eq(schema.users.username, "admin"),
              eq(schema.users.isAdmin, true)
          )
        });

        if (adminUser) {
          if (req.session) {
            req.session.userId = adminUser.id.toString();
            req.session.isAdmin = true;
          }

          return res.status(200).json({ success: true });
        }
      }

      return res.status(401).json({ message: "Неверные учетные данные" });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    if (req.session) {
      req.session.destroy(err => {
        if (err) {
          return res.status(500).json({ message: "Не удалось выйти из системы" });
        }
        res.clearCookie("connect.sid");
        res.status(200).json({ success: true });
      });
    } else {
      res.status(200).json({ success: true });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Пользователь не авторизован" });
      }

      // If it's the admin session, get admin user info
      if (req.session.isAdmin) {
        const adminUser = await db.query.users.findFirst({
          where: and(
              eq(schema.users.username, "admin"),
              eq(schema.users.isAdmin, true)
          )
        });

        if (adminUser) {
          return res.json({
            userId: adminUser.id.toString(),
            isAdmin: true,
            username: adminUser.username,
            firstName: adminUser.firstName,
            lastName: adminUser.lastName
          });
        }
      }

      // For regular users, get user info by ID
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, Number(req.session.userId))
      });

      if (user) {
        return res.json({
          userId: user.id.toString(),
          isAdmin: user.isAdmin,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName
        });
      }

      return res.status(404).json({ message: "Пользователь не найден" });
    } catch (error) {
      console.error("Error fetching user info:", error);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  });

  // Equipment routes
  app.get("/api/equipment", authMiddleware, async (req, res) => {
    try {
      const { inventoryNumber, employeeName } = req.query;
      const equipment = await storage.getEquipment(
          inventoryNumber as string | undefined,
          employeeName as string | undefined
      );
      res.json(equipment);
    } catch (error) {
      console.error("Error fetching equipment:", error);
      res.status(500).json({ message: "Не удалось загрузить данные об имуществе" });
    }
  });

  app.get("/api/equipment/template", authMiddleware, (req, res) => {
    const wb = XLSX.utils.book_new();

    const template = [
      ['Инвентарный номер', 'Наименование', 'Тип', 'Статус', 'Сотрудник (ФИО)', 'Отдел', 'Описание'],
      ['T-2023-001', 'HP EliteBook', 'Ноутбук', 'active', 'Иванов Иван', 'IT отдел', 'Пример записи']
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    XLSX.utils.book_append_sheet(wb, ws, "Оборудование");

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=equipment_template.xlsx');

    const buffer = XLSX.write(wb, { type: 'buffer' });
    res.send(buffer);
  });

  app.post("/api/equipment/import", authMiddleware, async (req, res) => {
    try {
      if (!req.files || !req.files.file) {
        return res.status(400).json({ message: "Файл не найден" });
      }

      const file = req.files.file;
      const workbook = XLSX.read(file.data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Skip header row
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row.length < 3) continue;

        const employeeName = row[4] ? row[4].toString().split(' ') : null;
        let assignedToUserId = null;

        if (employeeName && employeeName.length >= 2) {
          const lastName = employeeName[0];
          const firstName = employeeName[1];
          const users = await db.query.users.findMany({
            where: and(
                eq(schema.users.lastName, lastName),
                eq(schema.users.firstName, firstName)
            )
          });
          if (users.length > 0) {
            assignedToUserId = users[0].id;
          }
        }

        await storage.createEquipment({
          inventoryNumber: row[0],
          name: row[1],
          type: row[2],
          status: row[3] || 'storage',
          assignedToUserId,
          description: row[6],
          department: row[5]
        });
      }

      res.json({ message: "Импорт успешно завершен" });
    } catch (error) {
      console.error("Error importing equipment:", error);
      res.status(500).json({ message: "Ошибка при импорте данных" });
    }
  });

  app.post("/api/equipment", authMiddleware, async (req, res) => {
    try {
      const data = schema.equipmentInsertSchema.parse(req.body);
      const newEquipment = await storage.createEquipment(data);
      res.status(201).json(newEquipment);
    } catch (error) {
      console.error("Error creating equipment:", error);
      res.status(500).json({ message: "Не удалось создать запись об имуществе" });
    }
  });

  app.patch("/api/equipment/:id", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const updated = await storage.updateEquipment(Number(id), data);
      res.json(updated);
    } catch (error) {
      console.error("Error updating equipment:", error);
      res.status(500).json({ message: "Не удалось обновить данные об имуществе" });
    }
  });

  app.get("/api/equipment/:id/history", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const history = await storage.getEquipmentHistory(Number(id));
      res.json(history);
    } catch (error) {
      console.error("Error fetching equipment history:", error);
      res.status(500).json({ message: "Не удалось загрузить историю имущества" });
    }
  });

  // Users
  app.get("/api/users", authMiddleware, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Не удалось загрузить пользователей" });
    }
  });

  app.patch("/api/users/:id/role", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!Object.values(schema.ROLES).includes(role as schema.Role)) {
        return res.status(400).json({ message: "Неверная роль" });
      }

      const user = await storage.updateUserRole(Number(id), role as schema.Role);
      res.json(user);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Не удалось обновить роль пользователя" });
    }
  });

  app.patch("/api/users/:id/permissions", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { permissions } = req.body;

      const result = await storage.updateUserPermissions(Number(id), permissions);
      res.json(result);
    } catch (error) {
      console.error("Error updating user permissions:", error);
      res.status(500).json({ message: "Не удалось обновить разрешения пользователя" });
    }
  });

  app.delete("/api/users/:id", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = Number(id);

      // Проверяем, есть ли у пользователя связанные задачи
      const userTasks = await db.query.tasks.findMany({
        where: eq(schema.tasks.createdByUserId, userId)
      });

      // Если есть связанные задачи, возвращаем ошибку
      if (userTasks.length > 0) {
        return res.status(400).json({
          message: "Невозможно удалить пользователя, так как у него есть созданные задачи. Сначала удалите или переназначьте задачи."
        });
      }

      // Проверяем, есть ли у пользователя назначенные задачи
      const assignedTasks = await db.query.tasks.findMany({
        where: eq(schema.tasks.assignedToUserId, userId)
      });

      // Если есть назначенные задачи, возвращаем ошибку
      if (assignedTasks.length > 0) {
        return res.status(400).json({
          message: "Невозможно удалить пользователя, так как у него есть назначенные задачи. Сначала переназначьте задачи другому пользователю."
        });
      }

      // Проверяем, есть ли у пользователя привязанное оборудование
      const userEquipment = await db.query.equipment.findMany({
        where: eq(schema.equipment.assignedToUserId, userId)
      });

      // Если есть привязанное оборудование, возвращаем ошибку
      if (userEquipment.length > 0) {
        return res.status(400).json({
          message: "Невозможно удалить пользователя, так как за ним закреплено оборудование. Сначала переназначьте оборудование другому пользователю."
        });
      }

      // Если связанных записей нет, удаляем пользователя
      await storage.deleteUser(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Не удалось удалить пользователя" });
    }
  });

  // Tasks
  app.get("/api/tasks", authMiddleware, async (req, res) => {
    try {
      const { status } = req.query;
      const tasks = await storage.getTasks(status as string | undefined);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Не удалось загрузить задачи" });
    }
  });

  app.post("/api/tasks", authMiddleware, async (req, res) => {
    try {
      // For admin panel, use the admin user ID for created by
      const userId = req.session?.userId === "admin"
          ? (await storage.getAdminUser())?.id
          : Number(req.session?.userId);

      if (!userId) {
        return res.status(403).json({ message: "Пользователь не найден" });
      }

      const data = { ...req.body, createdByUserId: userId };
      const task = await storage.createTask(data);

      // Notify the assigned user if applicable
      if (task.assignedToUserId && telegramBot) {
        const assignedUser = await storage.getUserById(task.assignedToUserId);
        const creator = await storage.getUserById(task.createdByUserId);

        if (assignedUser && assignedUser.telegramId && creator) {
          const message = `📝 Вам назначена новая задача!\n\nЗаголовок: ${task.title}\nОписание: ${task.description}\nСтатус: ${taskStatusToRussian(task.status)}\nОт: ${creator.lastName} ${creator.firstName}`;

          telegramBot.telegram.sendMessage(assignedUser.telegramId, message)
              .catch(err => console.error("Failed to send task notification:", err));
        }
      }

      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Не удалось создать задачу" });
    }
  });

  app.patch("/api/tasks/:id", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!Object.values(schema.TASK_STATUS).include(status as schema.TaskStatus)) {
        return res.status(400).json({ message: "Неверный статус задачи" });
      }

      const task = await storage.updateTaskStatus(Number(id), status as schema.TaskStatus);

      // Notify user about status change if task is assigned and we have a bot
      if (task.assignedToUserId && telegramBot) {
        const assignedUser = await storage.getUserById(task.assignedToUserId);

        if (assignedUser && assignedUser.telegramId) {
          const message = `🔄 Изменение статуса задачи!\n\nЗаголовок: ${task.title}\nНовый статус: ${taskStatusToRussian(task.status)}`;

          telegramBot.telegram.sendMessage(assignedUser.telegramId, message)
              .catch(err => console.error("Failed to send status update notification:", err));
        }
      }

      res.json(task);
    } catch (error) {
      console.error("Error updating task status:", error);
      res.status(500).json({ message: "Не удалось обновить статус задачи" });
    }
  });

  app.patch("/api/tasks/:id/assign", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;

      const task = await storage.assignTask(Number(id), Number(userId));

      // Notify the newly assigned user
      if (task.assignedToUserId && telegramBot) {
        const assignedUser = await storage.getUserById(task.assignedToUserId);

        if (assignedUser && assignedUser.telegramId) {
          const message = `📋 Вам назначена задача!\n\nЗаголовок: ${task.title}\nОписание: ${task.description}\nСтатус: ${taskStatusToRussian(task.status)}`;

          telegramBot.telegram.sendMessage(assignedUser.telegramId, message)
              .catch(err => console.error("Failed to send assignment notification:", err));
        }
      }

      res.json(task);
    } catch (error) {
      console.error("Error assigning task:", error);
      res.status(500).json({ message: "Не удалось назначить задачу" });
    }
  });

  // Secure passwords
  app.get("/api/secure-passwords", authMiddleware, async (req, res) => {
    try {
      const passwords = await storage.getSecurePasswords();
      res.json(passwords);
    } catch (error) {
      console.error("Error fetching secure passwords:", error);
      res.status(500).json({ message: "Не удалось загрузить безопасные пароли" });
    }
  });

  app.post("/api/secure-passwords", authMiddleware, async (req, res) => {
    try {
      // For admin panel, use the admin user ID as sender
      const senderId = req.session?.userId === "admin"
          ? (await storage.getAdminUser())?.id
          : Number(req.session?.userId);

      if (!senderId) {
        return res.status(403).json({ message: "Отправитель не найден" });
      }

      const data = { ...req.body, senderId };
      const securePassword = await storage.createSecurePassword(data);

      // Notify the receiver if we have a bot
      if (telegramBot) {
        const receiver = await storage.getUserById(securePassword.receiverId);
        const sender = await storage.getUserById(securePassword.senderId);

        if (receiver && receiver.telegramId && sender) {
          const message = `🔐 Новая защищенная информация!\n\nОт: ${sender.lastName} ${sender.firstName}\nНазвание: ${securePassword.title}\nТип: ${securePasswordTypeToRussian(securePassword.type)}\n\nДля просмотра содержимого используйте команду /password ${securePassword.id}`;

          telegramBot.telegram.sendMessage(receiver.telegramId, message)
              .catch(err => console.error("Failed to send secure password notification:", err));
        }
      }

      res.status(201).json(securePassword);
    } catch (error) {
      console.error("Error creating secure password:", error);
      res.status(500).json({ message: "Не удалось создать безопасный пароль" });
    }
  });

  app.patch("/api/secure-passwords/:id/read", authMiddleware, async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.markPasswordAsRead(Number(id));
      res.json(updated);
    } catch (error) {
      console.error("Error marking password as read:", error);
      res.status(500).json({ message: "Не удалось отметить пароль как прочитанный" });
    }
  });

  // Bot settings
  app.get("/api/bot-settings", authMiddleware, async (req, res) => {
    try {
      const settings = await storage.getBotSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching bot settings:", error);
      res.status(500).json({ message: "Не удалось загрузить настройки бота" });
    }
  });

  app.patch("/api/bot-settings", authMiddleware, async (req, res) => {
    try {
      const settings = await storage.updateBotSettings(req.body);

      // Restart bot with new token if provided
      if (req.body.botToken) {
        setupBot(req.body.botToken);
      }

      res.json(settings);
    } catch (error) {
      console.error("Error updating bot settings:", error);
      res.status(500).json({ message: "Не удалось обновить настройки бота" });
    }
  });

  return httpServer;
}

// Helper functions for translating status to Russian
function taskStatusToRussian(status: string): string {
  const translations: Record<string, string> = {
    [schema.TASK_STATUS.NEW]: "Новая",
    [schema.TASK_STATUS.IN_PROGRESS]: "В процессе",
    [schema.TASK_STATUS.COMPLETED]: "Выполнено",
    [schema.TASK_STATUS.URGENT]: "Срочно"
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