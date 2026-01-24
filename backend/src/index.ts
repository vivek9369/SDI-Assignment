import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import Redis from 'redis';

import { emailQueue, emailWorker } from './queue/emailQueue';
import emailRoutes from './routes/emails';
import authRoutes from './routes/auth';
import rateLimiter from './middleware/rateLimiter';

dotenv.config();

const app: Express = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Test database connection
    await prisma.$executeRaw`SELECT 1`;
    console.log('✓ Database connected');

    // Test Redis connection
    const redis = Redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    redis.on('error', (err) => console.log('Redis Error:', err));
    await redis.connect();
    console.log('✓ Redis connected');
    await redis.disconnect();

    // Start email worker
    console.log('✓ Email worker initialized');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await emailWorker.close();
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

export { app, prisma };
