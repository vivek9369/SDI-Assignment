import { Queue, Worker, QueueOptions, WorkerOptions } from 'bullmq';
import Redis from 'redis';
import { PrismaClient } from '@prisma/client';
import { emailService } from '../services/emailService';
import { rateLimitService } from '../services/rateLimitService';

const prisma = new PrismaClient();

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const emailQueue = new Queue('email', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

interface EmailJobData {
  emailId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  batchId: string;
}

export const emailWorker = new Worker(
  'email',
  async (job) => {
    try {
      const { emailId, senderId, recipientEmail, subject, body, batchId }: EmailJobData = job.data;

      // Check rate limit before sending
      const canSend = await rateLimitService.checkAndIncrementRateLimit(senderId);

      if (!canSend) {
        // Reschedule for next available slot
        const nextAvailableTime = await rateLimitService.getNextAvailableSlot(senderId);
        console.log(`Rate limit reached for sender ${senderId}. Rescheduling for ${nextAvailableTime}`);
        
        await emailQueue.add(
          'email',
          job.data,
          {
            delay: nextAvailableTime.getTime() - Date.now(),
            jobId: `${emailId}-retry`,
          }
        );

        return { status: 'rescheduled', nextTime: nextAvailableTime };
      }

      // Apply minimum delay between emails
      await new Promise(resolve => 
        setTimeout(resolve, parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '1000'))
      );

      // Send email
      const result = await emailService.sendEmail({
        senderId,
        recipientEmail,
        subject,
        body,
      });

      // Update database
      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'sent',
          sentTime: new Date(),
          bullJobId: job.id,
        },
      });

      console.log(`✓ Email sent to ${recipientEmail}`);
      return { status: 'sent', emailId, recipientEmail };
    } catch (error) {
      console.error(`✗ Failed to send email ${job.id}:`, error);

      const { emailId } = job.data;
      await prisma.scheduledEmail.update({
        where: { id: emailId },
        data: {
          status: 'failed',
          failureReason: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10'),
  }
);

emailWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully`);
});

emailWorker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} failed with error:`, err.message);
});

emailQueue.on('error', (error) => {
  console.error('Queue error:', error);
});

export async function scheduleEmail(
  emailId: string,
  senderId: string,
  recipientEmail: string,
  subject: string,
  body: string,
  scheduledTime: Date,
  batchId: string
) {
  const delay = Math.max(0, scheduledTime.getTime() - Date.now());

  const job = await emailQueue.add(
    'email',
    {
      emailId,
      senderId,
      recipientEmail,
      subject,
      body,
      batchId,
    },
    {
      delay,
      jobId: emailId,
      removeOnComplete: true,
    }
  );

  return job;
}
