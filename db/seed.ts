import { db } from "./index";
import * as schema from "@shared/schema";
import * as crypto from "crypto";

async function seed() {
  try {
    console.log("Seeding database...");

    // Check if any users exist
    const existingUsers = await db.query.users.findMany({
      limit: 1
    });

    if (existingUsers.length > 0) {
      console.log("Database already has users. Skipping seeding of initial data.");
      return;
    }

    // Create initial admin user
    const adminPassword = crypto.createHash('sha256').update('admin123').digest('hex');
    
    const [admin] = await db.insert(schema.users).values({
      telegramId: "admin",
      username: "admin",
      firstName: "Админ",
      lastName: "Системный",
      role: schema.ROLES.ADMIN,
      isAdmin: true,
      isRegistered: true
    }).returning();

    console.log("Created admin user:", admin.username);

    // Create sample users
    const sampleUsers = [
      {
        telegramId: "123456789",
        username: "ivanov_p",
        firstName: "Петр",
        lastName: "Иванов",
        role: schema.ROLES.SYSADMIN,
        isRegistered: true
      },
      {
        telegramId: "987654321",
        username: "smirnova_k",
        firstName: "Ксения",
        lastName: "Смирнова",
        role: schema.ROLES.ACCOUNTANT,
        isRegistered: true
      },
      {
        telegramId: "567891234",
        username: "petrov_a",
        firstName: "Алексей",
        lastName: "Петров",
        role: schema.ROLES.MANAGER,
        isRegistered: true
      }
    ];

    const insertedUsers = await db.insert(schema.users).values(sampleUsers).returning();
    console.log(`Created ${insertedUsers.length} sample users`);

    // Setup permissions for sample users
    const permissions = [
      // Sysadmin - all permissions
      {
        userId: insertedUsers[0].id,
        chatType: schema.CHAT_TYPES.EQUIPMENT,
        hasAccess: true
      },
      {
        userId: insertedUsers[0].id,
        chatType: schema.CHAT_TYPES.PASSWORDS,
        hasAccess: true
      },
      {
        userId: insertedUsers[0].id,
        chatType: schema.CHAT_TYPES.TASKS,
        hasAccess: true
      },
      // Accountant - only equipment
      {
        userId: insertedUsers[1].id,
        chatType: schema.CHAT_TYPES.EQUIPMENT,
        hasAccess: true
      },
      {
        userId: insertedUsers[1].id,
        chatType: schema.CHAT_TYPES.PASSWORDS,
        hasAccess: false
      },
      {
        userId: insertedUsers[1].id,
        chatType: schema.CHAT_TYPES.TASKS,
        hasAccess: false
      },
      // Manager - passwords and tasks
      {
        userId: insertedUsers[2].id,
        chatType: schema.CHAT_TYPES.EQUIPMENT,
        hasAccess: false
      },
      {
        userId: insertedUsers[2].id,
        chatType: schema.CHAT_TYPES.PASSWORDS,
        hasAccess: true
      },
      {
        userId: insertedUsers[2].id,
        chatType: schema.CHAT_TYPES.TASKS,
        hasAccess: true
      }
    ];

    await db.insert(schema.permissions).values(permissions);
    console.log(`Set up permissions for sample users`);

    // Create sample equipment
    const equipment = [
      {
        inventoryNumber: "T-2022-001",
        name: "HP EliteBook 840 G7",
        type: "Ноутбук",
        status: schema.EQUIPMENT_STATUS.ACTIVE,
        assignedToUserId: insertedUsers[0].id,
        description: "Intel Core i7, 16GB RAM, 512GB SSD"
      },
      {
        inventoryNumber: "T-2022-015",
        name: "Dell P2419H",
        type: "Монитор",
        status: schema.EQUIPMENT_STATUS.ACTIVE,
        assignedToUserId: insertedUsers[1].id,
        description: "24-inch Full HD monitor"
      },
      {
        inventoryNumber: "T-2021-103",
        name: "Cisco Switch WS-C2960-24TC-L",
        type: "Сетевое оборудование",
        status: schema.EQUIPMENT_STATUS.STORAGE,
        description: "24-port Ethernet switch"
      }
    ];

    const insertedEquipment = await db.insert(schema.equipment).values(equipment).returning();
    console.log(`Created ${insertedEquipment.length} sample equipment items`);

    // Create equipment history
    const equipmentHistory = [
      {
        equipmentId: insertedEquipment[0].id,
        userId: admin.id,
        action: "Создано",
        details: "Добавлено в систему",
      },
      {
        equipmentId: insertedEquipment[0].id,
        userId: admin.id,
        action: "Назначено",
        details: `Назначено пользователю: ${insertedUsers[0].lastName} ${insertedUsers[0].firstName}`,
      },
      {
        equipmentId: insertedEquipment[1].id,
        userId: admin.id,
        action: "Создано",
        details: "Добавлено в систему",
      },
      {
        equipmentId: insertedEquipment[1].id,
        userId: admin.id,
        action: "Назначено",
        details: `Назначено пользователю: ${insertedUsers[1].lastName} ${insertedUsers[1].firstName}`,
      },
      {
        equipmentId: insertedEquipment[2].id,
        userId: admin.id,
        action: "Создано",
        details: "Добавлено в систему",
      }
    ];

    await db.insert(schema.equipmentHistory).values(equipmentHistory);
    console.log(`Created equipment history records`);

    // Create sample tasks
    const tasks = [
      {
        title: "Настройка нового ноутбука",
        description: "Необходимо установить ПО и настроить VPN на новом ноутбуке для нового сотрудника",
        createdByUserId: insertedUsers[2].id,
        assignedToUserId: insertedUsers[0].id,
        status: schema.TASK_STATUS.IN_PROGRESS
      },
      {
        title: "Сброс пароля почты",
        description: "Сотрудник забыл пароль от корпоративной почты. Необходимо сбросить.",
        createdByUserId: insertedUsers[1].id,
        assignedToUserId: insertedUsers[0].id,
        status: schema.TASK_STATUS.COMPLETED
      },
      {
        title: "Проблема с принтером",
        description: "Не печатает принтер в бухгалтерии. Ошибка подключения.",
        createdByUserId: insertedUsers[1].id,
        status: schema.TASK_STATUS.URGENT
      }
    ];

    const insertedTasks = await db.insert(schema.tasks).values(tasks).returning();
    console.log(`Created ${insertedTasks.length} sample tasks`);

    // Create sample secure passwords
    const securePasswords = [
      {
        senderId: insertedUsers[2].id,
        receiverId: insertedUsers[0].id,
        title: "Доступ к админ-панели",
        type: "credentials",
        encryptedContent: "Логин: admin\nПароль: super_secure_password_123",
        isRead: true
      },
      {
        senderId: insertedUsers[0].id,
        receiverId: insertedUsers[2].id,
        title: "API ключ для системы мониторинга",
        type: "api_key",
        encryptedContent: "API Key: 38a52c54f0c378d25b37428348e32b15",
        isRead: false
      }
    ];

    await db.insert(schema.securePasswords).values(securePasswords);
    console.log(`Created sample secure passwords`);

    // Create initial bot settings
    const botSettings = {
      key: "settings",
      value: {
        botToken: "",
        welcomeMessage: "Добро пожаловать в бота управления имуществом, паролями и задачами. Выберите роль, чтобы продолжить.",
        equipmentChatId: "",
        passwordsChatId: "",
        tasksChatId: "",
        adminUsernames: ["admin"]
      }
    };

    await db.insert(schema.botSettings).values(botSettings);
    console.log("Created initial bot settings");

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
