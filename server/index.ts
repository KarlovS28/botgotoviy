
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupBot } from "./bot";
import * as dotenv from "dotenv";
import session from "express-session";
import { createDefaultAdmin } from "./storage";

// Загружаем переменные окружения
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Create default admin user if none exists
  try {
    await createDefaultAdmin();
    log("Default admin user created or already exists");
  } catch (error) {
    console.error("Failed to create default admin:", error);
  }

  const server = await registerRoutes(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 3000;
  server.listen({
    port,
    host: "127.0.0.1",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);

    // Запуск Telegram бота
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    if (telegramBotToken) {
      try {
        setupBot(telegramBotToken);
        log(`Telegram bot started with token: ${telegramBotToken.substring(0, 8)}...`);
      } catch (error) {
        log(`Failed to start Telegram bot: ${error}`);
      }
    } else {
      log(`WARNING: No TELEGRAM_BOT_TOKEN provided, bot is not started`);
    }
  });
})();
