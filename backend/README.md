# ReachInbox Email Scheduler - Backend

Backend service for the email scheduler using Express.js, BullMQ, and Redis.

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL or MySQL
- Redis

### Installation

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key variables:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `ETHEREAL_EMAIL`: Ethereal test email
- `ETHEREAL_PASSWORD`: Ethereal password
- `MAX_EMAILS_PER_HOUR_PER_SENDER`: Rate limit (default: 200)
- `MIN_DELAY_BETWEEN_EMAILS_MS`: Minimum delay between sends (default: 1000ms)
- `WORKER_CONCURRENCY`: Number of parallel workers (default: 10)

### Running

Development:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

## Architecture

### Scheduling System
- **BullMQ** queues jobs to Redis with delays
- Jobs are scheduled to run at specific times using the `delay` option
- Workers process jobs with configurable concurrency
- State is persisted in Redis and PostgreSQL

### Persistence on Restart
- All scheduled jobs are stored in Redis
- Job metadata (email IDs, recipient, etc.) is in PostgreSQL
- On server restart, BullMQ automatically resumes pending jobs
- No cron jobs - purely event-driven with Redis

### Rate Limiting
- Per-sender hourly limit enforced via Redis counters
- When limit reached, jobs are rescheduled to next available hour
- Minute-level window tracking prevents duplicate sends
- Configurable via `MAX_EMAILS_PER_HOUR_PER_SENDER`

### Concurrency Control
- BullMQ workers configured with `concurrency` setting
- Each worker processes jobs in parallel up to the limit
- Minimum delay (`MIN_DELAY_BETWEEN_EMAILS_MS`) between sends
- Safe across multiple worker instances

## API Endpoints

### POST /api/emails/schedule
Schedule emails for sending
```json
{
  "subject": "Hello",
  "body": "<h1>Welcome</h1>",
  "recipients": ["user@example.com"],
  "startTime": "2024-02-01T10:00:00Z",
  "delayMs": 5000,
  "hourlyLimit": 200,
  "senderEmail": "sender@domain.com",
  "senderName": "Sender Name"
}
```

### GET /api/emails/scheduled
Get scheduled emails (paginated)

### GET /api/emails/sent
Get sent emails (paginated)

### GET /api/emails/stats
Get queue statistics

### POST /api/auth/google-login
Authenticate with Google
