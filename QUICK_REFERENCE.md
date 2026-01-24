# Quick Reference Guide

## Useful Commands

### Backend

```bash
# Development
cd backend
npm install
npm run dev

# Database
npx prisma generate           # Generate Prisma client
npx prisma migrate dev       # Run migrations
npx prisma migrate reset     # Reset database (⚠️ deletes data)
npx prisma studio           # Open Prisma GUI

# Production Build
npm run build
npm start
```

### Frontend

```bash
# Development
cd frontend
npm install
npm run dev

# Production Build
npm run build
npm start

# Lint
npm run lint
```

### Docker

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs
docker-compose logs postgres
docker-compose logs redis

# Restart
docker-compose restart

# Verify health
docker-compose ps
```

---

## Environment Variables Quick Setup

### Backend (.env)

```env
# Database
DATABASE_URL="postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_scheduler"

# Redis
REDIS_URL="redis://localhost:6379"

# Server
PORT=3001
NODE_ENV="development"

# Email (get from https://ethereal.email/)
ETHEREAL_EMAIL="your_email@ethereal.email"
ETHEREAL_PASSWORD="your_password"

# Rate Limiting
MAX_EMAILS_PER_HOUR_GLOBAL=500
MAX_EMAILS_PER_HOUR_PER_SENDER=200
MIN_DELAY_BETWEEN_EMAILS_MS=1000

# Worker
WORKER_CONCURRENCY=10
```

### Frontend (.env)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

---

## API Endpoints

### Authentication

```bash
# Login
POST /api/auth/google-login
{
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://...",
  "googleId": "123"
}

# Get Profile
GET /api/auth/profile
Headers: x-user-id: user_id
```

### Email Scheduling

```bash
# Schedule Emails
POST /api/emails/schedule
Headers: x-user-id: user_id
{
  "subject": "Subject",
  "body": "<p>HTML</p>",
  "recipients": ["user@example.com"],
  "startTime": "2024-02-01T10:00:00Z",
  "delayMs": 1000,
  "hourlyLimit": 200,
  "senderEmail": "sender@domain.com",
  "senderName": "Sender Name"
}

# Get Scheduled Emails
GET /api/emails/scheduled?page=1&limit=20
Headers: x-user-id: user_id

# Get Sent Emails
GET /api/emails/sent?page=1&limit=20
Headers: x-user-id: user_id

# Get Queue Stats
GET /api/emails/stats
Headers: x-user-id: user_id
```

---

## Database Queries

### PostgreSQL

```sql
-- Count emails by status
SELECT status, COUNT(*) FROM scheduled_emails GROUP BY status;

-- Recent scheduled emails
SELECT id, recipient_email, scheduled_time, status 
FROM scheduled_emails 
WHERE status = 'scheduled'
ORDER BY scheduled_time ASC;

-- Failed emails
SELECT id, recipient_email, failure_reason 
FROM scheduled_emails 
WHERE status = 'failed';

-- Sent emails today
SELECT id, recipient_email, sent_time 
FROM scheduled_emails 
WHERE status = 'sent' AND sent_time > NOW() - INTERVAL '1 day'
ORDER BY sent_time DESC;

-- Email count by sender
SELECT s.email, COUNT(*) 
FROM scheduled_emails se
JOIN senders s ON se.sender_id = s.id
GROUP BY s.id, s.email;
```

### Redis

```bash
# Connect to Redis
docker-compose exec redis redis-cli

# View all keys
KEYS *

# View rate limit keys
KEYS rate_limit:*

# Check rate limit for sender
GET rate_limit:sender_id:1707264000000

# View queue jobs
LLEN bull:email:*:job:waiting
LLEN bull:email:*:job:active
LLEN bull:email:*:job:completed

# Clear all keys (⚠️ careful!)
FLUSHALL
```

---

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Port 5432 in use | PostgreSQL already running | `lsof -i :5432` + kill process or change port |
| Port 6379 in use | Redis already running | `lsof -i :6379` + kill process or change port |
| Database connect error | Postgres not running | `docker-compose up -d` |
| Redis connect error | Redis not running | `docker-compose up -d` |
| Prisma not generated | Client not created | `npx prisma generate` |
| Migration failed | Schema out of sync | `npx prisma migrate reset` (deletes data) |
| Google login fails | Wrong Client ID | Check Google Cloud Console |
| CORS error | Backend not running | Start backend with `npm run dev` |
| Emails not sending | SMTP credentials wrong | Update `.env` with Ethereal creds |
| Rate limit not working | Need to restart | `npm run dev` after config change |

---

## Testing Checklist

Before deploying, verify:

- [ ] Backend starts without errors
- [ ] Frontend connects to backend
- [ ] Google OAuth login works
- [ ] Can schedule emails
- [ ] Emails appear in scheduled tab
- [ ] Emails move to sent tab after delay
- [ ] Stop & restart backend, emails still process
- [ ] Schedule 250+ emails, rate limiting works
- [ ] Failed email shows error message
- [ ] Dashboard pagination works
- [ ] Empty states display when no data
- [ ] Logout works and clears session

---

## Performance Tuning

### Increase Email Throughput

```env
# More concurrent jobs
WORKER_CONCURRENCY=20

# Less delay between sends
MIN_DELAY_BETWEEN_EMAILS_MS=500

# Higher rate limit
MAX_EMAILS_PER_HOUR_PER_SENDER=500
```

### Reduce Server Load

```env
# Fewer concurrent jobs
WORKER_CONCURRENCY=5

# More delay between sends
MIN_DELAY_BETWEEN_EMAILS_MS=2000

# Lower rate limit
MAX_EMAILS_PER_HOUR_PER_SENDER=100
```

### Database Optimization

```typescript
// Enable query logging
npx prisma generate -- --log-level info

// Use database indexes (already in schema)
// Check slow queries:
// PostgreSQL: SELECT * FROM pg_stat_statements;
```

---

## Deployment Steps

### Quick Development Deploy

```bash
# In project root
git clone <repo>
cd reachinbox

# Start services
docker-compose up -d

# Backend
cd backend
npm install
npx prisma migrate dev
npm run dev

# In new terminal - Frontend
cd frontend
npm install
npm run dev

# Access at localhost:3000
```

### Docker Production Deploy

```bash
# Build images
docker build -t reachinbox-backend ./backend
docker build -t reachinbox-frontend ./frontend

# Run with docker-compose.prod.yml
docker-compose -f docker-compose.prod.yml up -d

# Access at your domain
```

---

## Git Setup

```bash
# Initialize git
git init
git add .
git commit -m "Initial commit: ReachInbox Email Scheduler"

# Add remote
git remote add origin <your-repo-url>

# Push
git push -u origin main

# Create private repo settings
# Settings > Collaborators > Add user 'Mitrajit'
```

---

## Monitoring Dashboard

### Check System Health

```bash
# Backend logs
tail -f backend/logs.txt

# Frontend browser
F12 → Console tab for errors

# Database health
docker-compose exec postgres psql -U reachinbox -c "SELECT version();"

# Redis health
docker-compose exec redis redis-cli PING
# Response: PONG = OK
```

### View Real-time Metrics

```bash
# Terminal 1: Watch queue
watch -n 1 'curl -s -H "x-user-id: test" http://localhost:3001/api/emails/stats | jq'

# Terminal 2: Follow logs
docker-compose logs -f

# Terminal 3: Database view
npx prisma studio
```

---

## Debugging Tips

### Backend Issues

```typescript
// Add logging
console.log('Job processing:', {
  emailId,
  senderId,
  recipientEmail,
  timestamp: new Date().toISOString()
});

// Check rate limit
console.log('Rate limit count:', await rateLimitService.getRateLimitCount(senderId));

// Monitor queue
emailQueue.on('active', (job) => {
  console.log(`Job ${job.id} is now running`);
});
```

### Frontend Issues

```typescript
// Browser console
console.log('Scheduled emails:', scheduledEmails);
console.log('API response:', response);
console.log('Headers:', {
  'x-user-id': userId
});

// Network tab
// F12 → Network → Capture requests to API
```

### Database Issues

```sql
-- Check table structure
\d scheduled_emails

-- View all emails
SELECT id, recipient_email, status, created_at 
FROM scheduled_emails 
LIMIT 10;

-- Check foreign keys
SELECT constraint_name, table_name, column_name
FROM information_schema.key_column_usage
WHERE table_name = 'scheduled_emails';
```

---

## Useful Links

- **GitHub Repository**: Your repo URL
- **Google Cloud Console**: https://console.cloud.google.com/
- **Ethereal Email**: https://ethereal.email/
- **Prisma Docs**: https://www.prisma.io/docs/
- **BullMQ Docs**: https://docs.bullmq.io/
- **Next.js Docs**: https://nextjs.org/docs/
- **Tailwind CSS**: https://tailwindcss.com/docs/
- **Express.js**: https://expressjs.com/
- **PostgreSQL**: https://www.postgresql.org/docs/
- **Redis**: https://redis.io/documentation/

---

## Support

For questions or issues:

1. **Check Documentation**: README.md, SETUP.md, DEMO.md, ARCHITECTURE.md
2. **Check Logs**: Backend terminal, browser console, Docker logs
3. **Try Troubleshooting**: Common Issues table above
4. **Reset Everything**: `docker-compose down && docker-compose up -d`

---

Last Updated: 2024-02-01
Version: 1.0.0
Status: Production Ready ✅
