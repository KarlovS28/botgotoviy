import { db } from "../db";
import { eq, desc, and, like, or } from "drizzle-orm";
import * as schema from "@shared/schema";
import { leftJoin } from "drizzle-orm";

// Create default admin user if none exists
export async function createDefaultAdmin() {
    try {
        // Check if any admin users exist
        const adminUsers = await db.query.users.findMany({
            where: eq(schema.users.isAdmin, true),
            limit: 1
        });

        if (adminUsers.length > 0) {
            console.log("Admin user already exists, skipping default admin creation");
            return;
        }

        // Create default admin user
        const [adminUser] = await db.insert(schema.users).values({
            telegramId: "admin",
            username: "admin",
            firstName: "Администратор",
            lastName: "Системы",
            role: schema.ROLES.ADMIN,
            isAdmin: true,
            isRegistered: true
        }).returning();

        // Give admin user all permissions
        for (const chatType of Object.values(schema.CHAT_TYPES)) {
            await db.insert(schema.permissions).values({
                userId: adminUser.id,
                chatType,
                hasAccess: true
            });
        }

        console.log("Default admin user created successfully");
        console.log("Username: admin");
        console.log("Password: admin123");
        console.log("Please change the default password after first login!");
    } catch (error) {
        console.error("Error creating default admin user:", error);
    }
}

export const storage = {
    /**
     * Get all users with their permissions
     */
    async getAllUsers() {
        const users = await db.query.users.findMany({
            with: {
                permissions: true
            },
            orderBy: [desc(schema.users.createdAt)]
        });

        // Format permissions as object for easier frontend consumption
        return users.map(user => ({
            ...user,
            permissions: user.permissions.reduce((acc, perm) => {
                acc[perm.chatType] = perm.hasAccess;
                return acc;
            }, {} as Record<string, boolean>)
        }));
    },

    /**
     * Get user by ID
     */
    async getUserById(id: number) {
        return db.query.users.findFirst({
            where: eq(schema.users.id, id)
        });
    },

    /**
     * Get user by Telegram ID
     */
    async getUserByTelegramId(telegramId: string) {
        return db.query.users.findFirst({
            where: eq(schema.users.telegramId, telegramId),
            with: {
                permissions: true
            }
        });
    },

    /**
     * Create a new user
     */
    async createUser(userData: schema.InsertUser) {
        const [user] = await db.insert(schema.users)
            .values(userData)
            .returning();

        // Create default permissions
        await db.insert(schema.permissions).values([
            { userId: user.id, chatType: schema.CHAT_TYPES.EQUIPMENT, hasAccess: false },
            { userId: user.id, chatType: schema.CHAT_TYPES.PASSWORDS, hasAccess: false },
            { userId: user.id, chatType: schema.CHAT_TYPES.TASKS, hasAccess: false }
        ]);

        return user;
    },

    /**
     * Update user role
     */
    async updateUserRole(userId: number, role: schema.Role) {
        const [user] = await db.update(schema.users)
            .set({ role, updatedAt: new Date() })
            .where(eq(schema.users.id, userId))
            .returning();

        return user;
    },

    /**
     * Update user permissions
     */
    async updateUserPermissions(userId: number, permissions: Record<string, boolean>) {
        // Update each permission type
        for (const [chatType, hasAccess] of Object.entries(permissions)) {
            // Check if permission already exists
            const existingPerm = await db.query.permissions.findFirst({
                where: and(
                    eq(schema.permissions.userId, userId),
                    eq(schema.permissions.chatType, chatType)
                )
            });

            if (existingPerm) {
                // Update existing permission
                await db.update(schema.permissions)
                    .set({ hasAccess, updatedAt: new Date() })
                    .where(eq(schema.permissions.id, existingPerm.id));
            } else {
                // Create new permission
                await db.insert(schema.permissions)
                    .values({
                        userId,
                        chatType,
                        hasAccess
                    });
            }
        }

        // Return updated user with permissions
        const user = await db.query.users.findFirst({
            where: eq(schema.users.id, userId),
            with: {
                permissions: true
            }
        });

        return {
            ...user,
            permissions: user?.permissions.reduce((acc, perm) => {
                acc[perm.chatType] = perm.hasAccess;
                return acc;
            }, {} as Record<string, boolean>)
        };
    },

    /**
     * Delete a user
     */
    async deleteUser(userId: number) {
        // Use transaction to ensure all operations succeed or fail together
        return await db.transaction(async (tx) => {
            // First delete related records

            // 1. Delete secure passwords
            await tx.delete(schema.securePasswords)
                .where(or(
                    eq(schema.securePasswords.senderId, userId),
                    eq(schema.securePasswords.receiverId, userId)
                ));

            // 2. Delete equipment history
            await tx.delete(schema.equipmentHistory)
                .where(eq(schema.equipmentHistory.userId, userId));

            // 3. Delete permissions
            await tx.delete(schema.permissions)
                .where(eq(schema.permissions.userId, userId));

            // 4. Handle tasks - either delete or unassign
            // Option A: Delete tasks created by the user
            await tx.delete(schema.tasks)
                .where(eq(schema.tasks.createdByUserId, userId));

            // Option B: Or unassign tasks assigned to the user (if you want to keep the tasks)
            await tx.update(schema.tasks)
                .set({ assignedToUserId: null })
                .where(eq(schema.tasks.assignedToUserId, userId));

            // 5. Unassign equipment
            await tx.update(schema.equipment)
                .set({ assignedToUserId: null })
                .where(eq(schema.equipment.assignedToUserId, userId));

            // Finally delete the user
            await tx.delete(schema.users)
                .where(eq(schema.users.id, userId));
        });
    },

    /**
     * Get admin user
     */
    async getAdminUser() {
        return db.query.users.findFirst({
            where: eq(schema.users.isAdmin, true)
        });
    },

    /**
     * Equipment functions
     */

    /**
     * Get all equipment or filter by inventory number or employee name
     */
    async getEquipment(inventoryNumber?: string, employeeName?: string) {
        const baseQuery = db.select()
            .from(schema.equipment)
            .leftJoin(
                schema.users,
                eq(schema.users.id, schema.equipment.assignedToUserId)
            )
            .orderBy(desc(schema.equipment.updatedAt));

        if (!inventoryNumber && !employeeName) {
            const results = await baseQuery;
            return results.map(row => ({
                ...row.equipment,
                assignedUser: row.users || null
            }));
        }

        let filteredQuery = baseQuery;

        if (inventoryNumber) {
            filteredQuery = filteredQuery.where(
                like(schema.equipment.inventoryNumber, `%${inventoryNumber}%`)
            );
        }

        if (employeeName) {
            filteredQuery = filteredQuery.where(
                or(
                    like(schema.users.firstName, `%${employeeName}%`),
                    like(schema.users.lastName, `%${employeeName}%`)
                )
            );
        }

        const results = await filteredQuery;
        return results.map(row => ({
            ...row.equipment,
            assignedUser: row.users || null
        }));
    },

    /**
     * Create new equipment
     */
    async createEquipment(data: schema.InsertEquipment) {
        const [equipment] = await db.insert(schema.equipment)
            .values(data)
            .returning();

        // Record creation in history
        await db.insert(schema.equipmentHistory)
            .values({
                equipmentId: equipment.id,
                action: "Создано",
                details: "Добавлено в систему"
            });

        // Record assignment in history if assigned
        if (equipment.assignedToUserId) {
            const user = await this.getUserById(equipment.assignedToUserId);

            if (user) {
                await db.insert(schema.equipmentHistory)
                    .values({
                        equipmentId: equipment.id,
                        userId: equipment.assignedToUserId,
                        action: "Назначено",
                        details: `Назначено пользователю: ${user.lastName} ${user.firstName}`
                    });
            }
        }

        return equipment;
    },

    /**
     * Update equipment
     */
    async updateEquipment(id: number, data: Partial<schema.Equipment>) {
        const oldEquipment = await db.query.equipment.findFirst({
            where: eq(schema.equipment.id, id)
        });

        const [equipment] = await db.update(schema.equipment)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(schema.equipment.id, id))
            .returning();

        // Record changes in history
        if (oldEquipment) {
            // Check if status changed
            if (data.status && oldEquipment.status !== data.status) {
                await db.insert(schema.equipmentHistory)
                    .values({
                        equipmentId: id,
                        action: "Изменение статуса",
                        details: `Статус изменен с ${oldEquipment.status} на ${data.status}`
                    });
            }

            // Check if assignment changed
            if (data.assignedToUserId !== undefined &&
                oldEquipment.assignedToUserId !== data.assignedToUserId) {

                if (data.assignedToUserId) {
                    const user = await this.getUserById(data.assignedToUserId);

                    if (user) {
                        await db.insert(schema.equipmentHistory)
                            .values({
                                equipmentId: id,
                                userId: data.assignedToUserId,
                                action: "Назначено",
                                details: `Назначено пользователю: ${user.lastName} ${user.firstName}`
                            });
                    }
                } else {
                    await db.insert(schema.equipmentHistory)
                        .values({
                            equipmentId: id,
                            action: "Возврат",
                            details: "Возвращено на склад"
                        });
                }
            }
        }

        return equipment;
    },

    /**
     * Get equipment history
     */
    async getEquipmentHistory(equipmentId: number) {
        return db.query.equipmentHistory.findMany({
            where: eq(schema.equipmentHistory.equipmentId, equipmentId),
            with: {
                user: true
            },
            orderBy: [desc(schema.equipmentHistory.timestamp)]
        });
    },

    /**
     * Task functions
     */

    /**
     * Get all tasks or filter by status
     */
    async getTasks(status?: string) {
        return db.query.tasks.findMany({
            where: status ? eq(schema.tasks.status, status) : undefined,
            with: {
                assignedTo: true,
                createdBy: true
            },
            orderBy: [desc(schema.tasks.createdAt)]
        });
    },

    /**
     * Create a new task
     */
    async createTask(data: Partial<schema.Task>) {
        const [task] = await db.insert(schema.tasks)
            .values(data as any)
            .returning();

        return task;
    },

    /**
     * Update task status
     */
    async updateTaskStatus(id: number, status: schema.TaskStatus) {
        const [task] = await db.update(schema.tasks)
            .set({ status, updatedAt: new Date() })
            .where(eq(schema.tasks.id, id))
            .returning();

        return task;
    },

    /**
     * Assign task to user
     */
    async assignTask(id: number, userId: number) {
        const [task] = await db.update(schema.tasks)
            .set({ assignedToUserId: userId, updatedAt: new Date() })
            .where(eq(schema.tasks.id, id))
            .returning();

        return task;
    },

    /**
     * Secure passwords functions
     */

    /**
     * Get all secure passwords
     */
    async getSecurePasswords() {
        return db.query.securePasswords.findMany({
            with: {
                sender: true,
                receiver: true
            },
            orderBy: [desc(schema.securePasswords.createdAt)]
        });
    },

    /**
     * Get secure passwords for a specific user
     */
    async getUserSecurePasswords(userId: number) {
        return db.query.securePasswords.findMany({
            where: or(
                eq(schema.securePasswords.senderId, userId),
                eq(schema.securePasswords.receiverId, userId)
            ),
            with: {
                sender: true,
                receiver: true
            },
            orderBy: [desc(schema.securePasswords.createdAt)]
        });
    },

    /**
     * Get a specific secure password
     */
    async getSecurePasswordById(id: number) {
        return db.query.securePasswords.findFirst({
            where: eq(schema.securePasswords.id, id),
            with: {
                sender: true,
                receiver: true
            }
        });
    },

    /**
     * Create a new secure password
     */
    async createSecurePassword(data: Partial<schema.SecurePassword>) {
        const [password] = await db.insert(schema.securePasswords)
            .values(data as any)
            .returning();

        return password;
    },

    /**
     * Mark a password as read
     */
    async markPasswordAsRead(id: number) {
        const [password] = await db.update(schema.securePasswords)
            .set({ isRead: true, updatedAt: new Date() })
            .where(eq(schema.securePasswords.id, id))
            .returning();

        return password;
    },

    /**
     * Bot settings functions
     */

    /**
     * Get bot settings
     */
    async getBotSettings() {
        const settings = await db.query.botSettings.findFirst({
            where: eq(schema.botSettings.key, "settings")
        });

        return settings?.value as any;
    },

    /**
     * Update bot settings
     */
    async updateBotSettings(data: any) {
        const settings = await db.query.botSettings.findFirst({
            where: eq(schema.botSettings.key, "settings")
        });

        if (settings) {
            const [updated] = await db.update(schema.botSettings)
                .set({
                    value: data,
                    updatedAt: new Date()
                })
                .where(eq(schema.botSettings.id, settings.id))
                .returning();

            return updated.value;
        } else {
            const [created] = await db.insert(schema.botSettings)
                .values({
                    key: "settings",
                    value: data
                })
                .returning();

            return created.value;
        }
    }
};