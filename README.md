# ReachInbox Email Scheduler - Production Grade Assignment

Complete full-stack email scheduler service with persistent job queue, rate limiting, and real-time dashboard.

## 🎯 Overview

This is a production-grade email scheduler built for ReachInbox that demonstrates:

- **Event-driven architecture** using BullMQ + Redis (no cron jobs)
- **Persistent scheduling** - survives server restarts
- **Rate limiting** - per-sender hourly limits with configurable concurrency
- **Production UI** - React/Next.js dashboard with Google OAuth
- **Real SMTP** - Ethereal Email integration for testing

## 📁 Project Structure

```
reachinbox/
├── backend/
│   ├── src/
│   │   ├── index.ts                 # Express server
│   │   ├── queue/
│   │   │   └── emailQueue.ts        # BullMQ worker & scheduler
│   │   ├── services/
│   │   │   ├── emailService.ts      # SMTP logic
│   │   │   └── rateLimitService.ts  # Rate limiting
│   │   ├── routes/
│   │   │   ├── emails.ts            # Email endpoints
│   │   │   └── auth.ts              # Auth endpoints
│   │   └── middleware/
│   │       └── rateLimiter.ts
│   ├── prisma/
│   │   └── schema.prisma            # Database schema
│   ├── package.json
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Main dashboard
│   │   │   ├── layout.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── ui.tsx               # Reusable components
│   │   │   ├── AuthPage.tsx         # Google OAuth
│   │   │   ├── Header.tsx
│   │   │   ├── ComposeEmailModal.tsx
│   │   │   ├── ScheduledEmailsTable.tsx
│   │   │   └── SentEmailsTable.tsx
│   │   ├── context/
│   │   │   └── AuthContext.tsx
│   │   ├── api.ts                   # API client
│   │   └── config.ts
│   └── package.json
├── docker-compose.yml               # PostgreSQL + Redis
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL / Redis (or use Docker)
- Google OAuth credentials

### 1. Clone & Setup

```bash
# Clone repository
git clone <repo-url>
cd reachinbox

# Start databases
docker-compose up -d

# Verify services
docker-compose ps
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your values
# DATABASE_URL=postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_scheduler
# REDIS_URL=redis://localhost:6379
# ETHEREAL_EMAIL=your_ethereal_email@ethereal.email
# ETHEREAL_PASSWORD=your_ethereal_password

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Start server
npm run dev

# Server runs on http://localhost:3001
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with:
# NEXT_PUBLIC_API_URL=http://localhost:3001/api
# NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# Start development server
npm run dev

# Dashboard available at http://localhost:3000
```

## 🔧 Configuration

### Backend Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/reachinbox_scheduler

# Redis
REDIS_URL=redis://localhost:6379

# Server
PORT=3001
NODE_ENV=development

# Email (Ethereal)
ETHEREAL_EMAIL=user@ethereal.email
ETHEREAL_PASSWORD=password

# Rate Limiting
MAX_EMAILS_PER_HOUR_GLOBAL=500
MAX_EMAILS_PER_HOUR_PER_SENDER=200
MIN_DELAY_BETWEEN_EMAILS_MS=1000

# Worker
WORKER_CONCURRENCY=10
```

### Frontend Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
```

## 🏗️ Architecture

### Scheduling System

**BullMQ Job Queue:**
- Jobs are created with a `delay` parameter specifying when to run
- Redis stores job state persistently
- On server restart, pending jobs automatically resume
- No polling or cron jobs - purely event-driven

**Flow:**
```
1. User schedules 100 emails starting at 2024-02-01 10:00 AM
2. Backend creates 100 jobs in Redis with delays:
   - Email 1: delay = 0ms (run now)
   - Email 2: delay = 1000ms (run in 1 second)
   - Email 3: delay = 2000ms (run in 2 seconds)
   - ... etc
3. BullMQ worker processes jobs as they're due
4. If server restarts, pending jobs continue from where they left off
5. Database tracks email status (scheduled → sent/failed)
```

### Persistence on Restart

**Job Storage:**
- All queued jobs stored in Redis (not memory)
- Job metadata in PostgreSQL for UI
- On restart, BullMQ replays all pending jobs

**Email State:**
- `scheduled`: Job queued, not yet sent
- `sent`: Successfully delivered
- `failed`: Error during sending (with reason)

**No Data Loss:**
```
Server: ↓ (restart)
├─ Jobs in Redis still exist
├─ Worker resumes pending jobs
├─ New jobs continue processing
└─ UI shows accurate status
```

### Rate Limiting Strategy

**Per-Sender Hourly Limit:**

Uses Redis counters keyed by `hour_window + sender_id`:

```typescript
// Check current hour count
const hourKey = `rate_limit:${senderId}:${currentHourTimestamp}`
const count = redis.incr(hourKey)
const limit = MAX_EMAILS_PER_HOUR_PER_SENDER

if (count > limit) {
  // Reschedule to next hour
  const nextHour = new Date()
  nextHour.setHours(nextHour.getHours() + 1)
  queue.add(job, { delay: nextHour - now })
}
```

**Per-Email Minimum Delay:**

Enforced in worker before SMTP send:

```typescript
// Wait before each send
await sleep(MIN_DELAY_BETWEEN_EMAILS_MS)
await smtpTransport.sendMail(...)
```

**Safety Across Multiple Workers:**

- Redis counters are atomic (`INCR`)
- Multiple worker instances share same Redis
- No race conditions or duplicate sends
- Configurable via environment variables

**Under Load (1000+ emails):**
- Email 1-200: Sent in hour 1 (0-3600 seconds)
- Email 201-400: Scheduled for hour 2
- Email 401-600: Scheduled for hour 3
- ... and so on
- Order preserved per sender

### Concurrency Control

**BullMQ Worker Configuration:**

```typescript
new Worker('email', jobProcessor, {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '10'),
  connection: redisConnection,
})
```

**What This Means:**
- Up to 10 jobs run in parallel (configurable)
- Each job waits `MIN_DELAY_BETWEEN_EMAILS_MS` before sending
- Safe across multiple worker instances
- Resource-efficient (doesn't overwhelm SMTP server)

## 📊 API Endpoints

### Authentication

**POST /api/auth/google-login**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://...",
  "googleId": "123456"
}
```

Response:
```json
{
  "success": true,
  "user": { "id", "email", "name", "avatar" },
  "token": "base64_encoded_token"
}
```

### Email Scheduling

**POST /api/emails/schedule**
```json
{
  "subject": "Welcome!",
  "body": "<h1>Hello!</h1>",
  "recipients": ["user1@example.com", "user2@example.com"],
  "startTime": "2024-02-01T10:00:00Z",
  "delayMs": 1000,
  "hourlyLimit": 200,
  "senderEmail": "sender@example.com",
  "senderName": "Sender Name"
}
```

Response:
```json
{
  "success": true,
  "batchId": "uuid",
  "emailCount": 2,
  "jobIds": ["job1", "job2"],
  "startTime": "2024-02-01T10:00:00Z"
}
```

**GET /api/emails/scheduled?page=1&limit=20**

Returns scheduled emails with pagination

**GET /api/emails/sent?page=1&limit=20**

Returns sent emails with pagination

**GET /api/emails/stats**

Returns queue statistics

## 🎨 Frontend Features

### Authentication
- ✅ Real Google OAuth login
- ✅ Persistent user session (via cookies)
- ✅ User profile in header (name, email, avatar)
- ✅ Logout functionality

### Dashboard
- ✅ Tab navigation (Scheduled / Sent)
- ✅ Scheduled emails table with status
- ✅ Sent emails table with timestamps
- ✅ Pagination support
- ✅ Refresh button
- ✅ Loading states
- ✅ Empty states

### Compose Email
- ✅ Modal form for creating emails
- ✅ Subject & HTML body input
- ✅ CSV file upload with email parsing
- ✅ Recipient count display
- ✅ Scheduling options:
  - Start time picker
  - Delay between emails (ms)
  - Hourly limit
- ✅ From sender selection/creation
- ✅ Error handling & validation

### UI Components
- ✅ Reusable Button, Input, Select, Textarea, Card, Modal
- ✅ Loading spinner
- ✅ Tables with sorting & pagination
- ✅ Responsive design (Tailwind CSS)
- ✅ Clean, professional styling

## 📝 Database Schema

### Users Table
- `id`: Primary key
- `email`: Unique email
- `name`: User name
- `avatar`: Profile picture URL

### Senders Table
- `id`: Primary key
- `userId`: Foreign key to Users
- `email`: From email address
- `name`: From name

### ScheduledEmails Table
- `id`: Primary key
- `userId`: Foreign key
- `senderId`: Foreign key (which sender)
- `recipientEmail`: To address
- `subject`, `body`: Email content
- `scheduledTime`: When to send
- `sentTime`: When actually sent
- `status`: scheduled/sent/failed
- `failureReason`: Error message if failed
- `bullJobId`: BullMQ job ID for tracking
- `batchId`: Group emails from same request

### EmailBatch Table
- `id`: Primary key
- `userId`: Foreign key
- `recipients`: Array of email addresses
- Metadata for batch operations

## 🧪 Testing / Demo

### Manual Testing with Postman

```
# 1. Login
POST http://localhost:3001/api/auth/google-login
Body: {
  "email": "test@example.com",
  "name": "Test User",
  "picture": "...",
  "googleId": "123"
}

# 2. Schedule emails
POST http://localhost:3001/api/emails/schedule
Headers: x-user-id: <user_id>
Body: {
  "subject": "Hello",
  "body": "<p>Test</p>",
  "recipients": ["test1@example.com", "test2@example.com"],
  "startTime": "2024-02-01T10:00:00Z",
  "delayMs": 1000,
  "hourlyLimit": 200,
  "senderEmail": "sender@example.com",
  "senderName": "Test Sender"
}

# 3. Get scheduled emails
GET http://localhost:3001/api/emails/scheduled
Headers: x-user-id: <user_id>

# 4. Get sent emails
GET http://localhost:3001/api/emails/sent
Headers: x-user-id: <user_id>
```

### Server Restart Scenario

```bash
# Terminal 1: Start server
cd backend
npm run dev

# Terminal 2: Schedule emails
# ... (use Postman to schedule emails at a future time)

# Terminal 1: Stop server (Ctrl+C)
# Wait 10 seconds

# Terminal 1: Restart server
npm run dev

# Check: Scheduled emails should still process at their scheduled time
# UI dashboard should show the same emails
```

### Rate Limiting Demo

```
# Schedule 250 emails for same hour (limit: 200/hour)
POST /api/emails/schedule
{
  "recipients": [...250 emails...],
  "startTime": "2024-02-01T10:00:00Z",
  "hourlyLimit": 200
}

# Result:
# - First 200 sent in hour 1 (0-3600 seconds)
# - Remaining 50 rescheduled to hour 2 (3600-7200 seconds)
# - No duplicate sends
# - Order preserved
```

## 🔑 Key Features Implemented

### Backend ✅
- [x] Express.js server with TypeScript
- [x] BullMQ job scheduling (no cron)
- [x] Redis persistence
- [x] PostgreSQL database with Prisma
- [x] Ethereal SMTP integration
- [x] Per-sender rate limiting
- [x] Configurable concurrency
- [x] Delay between email sends
- [x] Graceful shutdown
- [x] Job retry logic
- [x] Pagination support

### Frontend ✅
- [x] Real Google OAuth authentication
- [x] User session persistence
- [x] Dashboard layout
- [x] Scheduled emails table
- [x] Sent emails table
- [x] Compose email modal
- [x] CSV file upload & parsing
- [x] Form validation
- [x] Loading states
- [x] Empty states
- [x] Error handling
- [x] Responsive design
- [x] Tailwind CSS styling
- [x] Reusable components

### Infrastructure ✅
- [x] Docker Compose setup
- [x] PostgreSQL container
- [x] Redis container
- [x] Environment configuration
- [x] Health checks

## 📦 Dependencies

### Backend
- `express`: Web framework
- `bullmq`: Job queue
- `redis`: Cache & job store
- `@prisma/client`: ORM
- `nodemailer`: SMTP client
- `typescript`: Type safety

### Frontend
- `react`: UI library
- `next.js`: React framework
- `tailwindcss`: Styling
- `@react-oauth/google`: OAuth provider
- `axios`: HTTP client
- `papaparse`: CSV parser

## 🚨 Important Constraints Met

✅ **No Cron Jobs** - Uses BullMQ delayed jobs exclusively

✅ **Persistent Scheduling** - Jobs survive server restart

✅ **No Duplicate Sends** - Idempotent job processing with unique IDs

✅ **Rate Limiting** - Per-sender hourly limits with Redis backing

✅ **Concurrency Control** - Configurable worker parallelism

✅ **Production Ready** - Error handling, logging, health checks

✅ **Scalable** - Works across multiple worker instances

## 📄 License

MIT - Built for ReachInbox

## 🤝 Support

For questions or issues, please refer to the backend and frontend README files for detailed setup instructions.
