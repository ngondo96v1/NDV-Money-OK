
import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import * as dotenv from "dotenv";
import { Server } from "socket.io";
import http from "http";
import { rateLimit } from "express-rate-limit";
import compression from "compression";

// Load environment variables from .env file
dotenv.config();

import { apiRouter, keepAliveSupabase, autoCleanupStorage, runDailySystemTasks } from "./api/index.ts";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  
  // Trust proxy is required for express-rate-limit to work correctly behind a reverse proxy (like nginx/Cloud Run)
  app.set('trust proxy', 1);
  
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Make io accessible to routes
  app.set("io", io);

  // Keep track of connected sockets and their associated user information
  const activeSockets = new Map<string, { userId?: string; isAdmin?: boolean }>();

  // A helper to compute custom online users count precisely
  const getActiveUsersCount = () => {
    const uniqueUserIds = new Set<string>();
    let anonymousCount = 0;
    
    for (const info of activeSockets.values()) {
      if (info.userId && info.userId !== 'anonymous') {
        uniqueUserIds.add(info.userId);
      } else {
        anonymousCount++;
      }
    }
    const currentOnline = uniqueUserIds.size + anonymousCount;
    // Maintain a safe, human-realistic minimum of at least 1 (the currently browsing admin)
    return Math.max(1, currentOnline);
  };

  app.set("getActiveUsersCount", getActiveUsersCount);

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);

  // Socket.io connection handling with real-time online status broadcast
  io.on("connection", (socket) => {
    // Register temporary anonymous socket session
    activeSockets.set(socket.id, { userId: 'anonymous', isAdmin: false });
    
    // Auto broadcast updated online stats to the admin room immediately
    io.to("admin").emit("online_users_updated", { count: getActiveUsersCount() });

    socket.on("join", (data) => {
      const { userId, isAdmin } = data;
      if (isAdmin) {
        socket.join("admin");
        console.log(`[SOCKET] ${socket.id} joined admin room`);
      }
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`[SOCKET] ${socket.id} joined room user_${userId}`);
      }
      
      // Update entry with real credentials
      activeSockets.set(socket.id, { userId: userId || 'anonymous', isAdmin: !!isAdmin });
      
      // Sync stats
      io.to("admin").emit("online_users_updated", { count: getActiveUsersCount() });
    });

    socket.on("disconnect", () => {
      console.log(`[SOCKET] Disconnected: ${socket.id}`);
      activeSockets.delete(socket.id);
      
      // Sync stats
      io.to("admin").emit("online_users_updated", { count: getActiveUsersCount() });
    });
  });

  app.use((req, res, next) => {
    // Skip logging for static assets in development to reduce noise
    if (process.env.NODE_ENV !== "production" && (req.url.endsWith(".tsx") || req.url.endsWith(".ts") || req.url.endsWith(".css") || req.url.includes("node_modules"))) {
      return next();
    }
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(compression());

  // Mount the API router
  app.use("/api", apiRouter);

  // Fall-through for /api that didn't match any route in apiRouter
  app.use("/api", (req, res) => {
    console.warn(`[SERVER WARN] API route not found in router: ${req.method} ${req.url}`);
    res.status(404).json({
      error: "API Route Not Found",
      message: `Đường dẫn API không tồn tại: ${req.method} ${req.url}`
    });
  });

  // Vite middleware for development
  const distPath = path.join(process.cwd(), "dist");
  const useVite = process.env.NODE_ENV !== "production" || !fs.existsSync(distPath);

  if (useVite) {
    console.log("Using Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving static files from dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Production build not found. Please run 'npm run build'.");
      }
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Initial System Maintenance on startup (delayed to allow for setup)
    setTimeout(() => {
      runDailySystemTasks(io);
    }, 10000);
    
    // Check and run daily tasks every 1 hour
    setInterval(() => {
      runDailySystemTasks(io);
    }, 1 * 60 * 60 * 1000);

  });

  // Global error handler - MUST be after all other routes
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("UNHANDLED ERROR:", err);
    
    // Ensure we always return JSON
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Đã xảy ra lỗi hệ thống không xác định";
    
    if (!res.headersSent) {
      res.status(status).json({ 
        error: "Lỗi máy chủ nội bộ", 
        message: message,
        path: req.url,
        method: req.method,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  });
}

startServer().catch(err => {
  console.error("CRITICAL: Failed to start server:", err);
});
