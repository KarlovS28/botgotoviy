import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Создаем клиент PostgreSQL
const client = postgres(process.env.DATABASE_URL);

// Инициализируем Drizzle ORM
export const db = drizzle(client, { schema });

// Опционально: экспортируем клиент для прямых запросов
export const sql = client;