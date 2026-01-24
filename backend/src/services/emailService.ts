import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

let transporter: nodemailer.Transporter | null = null;

async function initializeTransporter() {
  if (transporter) return transporter;

  // Create test account if no credentials provided
  let testAccount = await nodemailer.createTestAccount();

  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: process.env.ETHEREAL_EMAIL || testAccount.user,
      pass: process.env.ETHEREAL_PASSWORD || testAccount.pass,
    },
  });

  return transporter;
}

export const emailService = {
  async sendEmail(params: {
    senderId: string;
    recipientEmail: string;
    subject: string;
    body: string;
  }) {
    try {
      const transporter = await initializeTransporter();

      // Get sender details
      const sender = await prisma.sender.findUnique({
        where: { id: params.senderId },
      });

      if (!sender) {
        throw new Error(`Sender ${params.senderId} not found`);
      }

      const info = await transporter.sendMail({
        from: `"${sender.name}" <${sender.email}>`,
        to: params.recipientEmail,
        subject: params.subject,
        html: params.body,
      });

      console.log(`Email sent via Ethereal. Preview URL: ${nodemailer.getTestMessageUrl(info)}`);

      return {
        success: true,
        messageId: info.messageId,
        preview: nodemailer.getTestMessageUrl(info),
      };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  },

  async verifyConnection() {
    try {
      const transporter = await initializeTransporter();
      await transporter.verify();
      console.log('✓ SMTP connection verified');
      return true;
    } catch (error) {
      console.error('✗ SMTP verification failed:', error);
      return false;
    }
  },
};
