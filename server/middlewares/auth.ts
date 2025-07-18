import { Request, Response, NextFunction } from "express";

// Simple session-based authentication middleware
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check if user is authenticated
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: "Пользователь не авторизован" });
  }
  
  // Check if admin for admin-only routes
  if (req.originalUrl.startsWith('/api/admin') && !req.session.isAdmin) {
    return res.status(403).json({ message: "Доступ запрещен" });
  }
  
  // User is authenticated
  next();
}
