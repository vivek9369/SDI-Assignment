import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { scheduleEmail, emailQueue } from '../queue/emailQueue';

const router = Router();
const prisma = new PrismaClient();

// Middleware to verify user (in production, use JWT)
const verifyUser = (req: Request, res: Response, next: Function) => {
  // For now, accept userId from header
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  (req as any).userId = userId;
  next();
};

// Schedule new emails
router.post('/schedule', verifyUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { subject, body, recipients, startTime, delayMs, hourlyLimit, senderEmail, senderName } = req.body;

    if (!subject || !body || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Invalid request parameters' });
    }

    // Get or create sender
    let sender = await prisma.sender.findFirst({
      where: {
        userId,
        email: senderEmail,
      },
    });

    if (!sender) {
      sender = await prisma.sender.create({
        data: {
          userId,
          email: senderEmail,
          name: senderName || 'Default Sender',
        },
      });
    }

    // Create email batch
    const batchId = randomUUID();
    const scheduledEmails = await prisma.scheduledEmail.createMany({
      data: recipients.map((recipientEmail: string, index: number) => ({
        userId,
        senderId: sender!.id,
        recipientEmail,
        subject,
        body,
        batchId,
        scheduledTime: new Date(startTime.getTime() + (index * delayMs)),
      })),
    });

    // Schedule jobs in BullMQ
    const jobs = [];
    for (let i = 0; i < recipients.length; i++) {
      const email = await prisma.scheduledEmail.findFirst({
        where: {
          batchId,
          recipientEmail: recipients[i],
        },
      });

      if (email) {
        const job = await scheduleEmail(
          email.id,
          sender.id,
          recipients[i],
          subject,
          body,
          new Date(startTime.getTime() + (i * delayMs)),
          batchId
        );
        jobs.push(job);
      }
    }

    res.json({
      success: true,
      batchId,
      emailCount: recipients.length,
      jobIds: jobs.map(j => j.id),
      startTime: new Date(startTime),
    });
  } catch (error) {
    console.error('Error scheduling emails:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to schedule emails',
    });
  }
});

// Get scheduled emails
router.get('/scheduled', verifyUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const emails = await prisma.scheduledEmail.findMany({
      where: { userId, status: 'scheduled' },
      include: { sender: true },
      orderBy: { scheduledTime: 'asc' },
      skip,
      take: limit,
    });

    const total = await prisma.scheduledEmail.count({
      where: { userId, status: 'scheduled' },
    });

    res.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching scheduled emails:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

// Get sent emails
router.get('/sent', verifyUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const emails = await prisma.scheduledEmail.findMany({
      where: { userId, status: { in: ['sent', 'failed'] } },
      include: { sender: true },
      orderBy: { sentTime: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.scheduledEmail.count({
      where: { userId, status: { in: ['sent', 'failed'] } },
    });

    res.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching sent emails:', error);
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

// Get queue stats
router.get('/stats', verifyUser, async (req: Request, res: Response) => {
  try {
    const counts = await emailQueue.getJobCounts();
    const activeJobs = await emailQueue.getActiveCount();
    const failedJobs = await emailQueue.getFailedCount();

    res.json({
      queue: counts,
      active: activeJobs,
      failed: failedJobs,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
