# Architecture & Design Deep Dive

Comprehensive technical documentation of ReachInbox Email Scheduler architecture.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Dashboard                                               │  │
│  │  ├─ Scheduled Emails Table                             │  │
│  │  ├─ Sent Emails Table                                  │  │
│  │  └─ Compose Modal                                      │  │
│  └────────────────────────────┬─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                    HTTP / REST  │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (Express.js)                          │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  API Routes                                            │    │
│  │  ├─ POST /auth/google-login                          │    │
│  │  ├─ POST /emails/schedule                            │    │
│  │  ├─ GET /emails/scheduled                            │    │
│  │  ├─ GET /emails/sent                                 │    │
│  │  └─ GET /emails/stats                                │    │
│  └────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Email Service                                         │    │
│  │  └─ SMTP Sender (Ethereal Email)                     │    │
│  └────────────────────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  Rate Limiter Service                                 │    │
│  │  └─ Per-sender hourly limit tracking                 │    │
│  └────────────────────────────────────────────────────────┘    │
└──────────────────┬───────────────────────┬─────────────────────┘
                   │                       │
        Queue API  │    DB Query/Update    │
                   ▼                       ▼
        ┌──────────────────┐    ┌──────────────────┐
        │   BullMQ Queue   │    │   PostgreSQL DB  │
        │   (Redis Store)  │    │                  │
        │                  │    │  Tables:         │
        │ Job Queue:       │    │  ├─ users        │
        │ ├─ Pending       │    │  ├─ senders      │
        │ ├─ Active        │    │  ├─ scheduled... │
        │ ├─ Completed     │    │  └─ email_batch  │
        │ └─ Failed        │    │                  │
        └────────┬─────────┘    └──────────────────┘
                 │
                 │ Job Dispatch (delay-based)
                 ▼
        ┌──────────────────┐
        │  BullMQ Worker   │
        │                  │
        │ ├─ Concurrency:10│
        │ ├─ Rate Limit    │
        │ ├─ Min Delay 1s  │
        │ └─ SMTP Send     │
        └──────────────────┘
                 │
                 │ Send Email
                 ▼
        ┌──────────────────────┐
        │  Ethereal SMTP       │
        │  (Fake Email)        │
        └──────────────────────┘
```

## Data Flow

### 1. Email Scheduling Flow

```
User Input
    │
    ├─ Subject, Body, Recipients
    ├─ Start Time, Delays, Limits
    └─ Sender Info
         │
         ▼
[Compose Modal] (Frontend)
    │
    └─ POST /api/emails/schedule
              │
              ├─ Payload: {subject, body, recipients[], startTime, ...}
              └─ Header: x-user-id
                   │
                   ▼
[Backend Handler] (Express)
    │
    ├─ 1. Validate input
    ├─ 2. Get/create sender in DB
    └─ 3. Create batch ID
         │
         ▼
[Prisma ORM] → PostgreSQL
    │
    ├─ INSERT into scheduled_emails (×100 records)
    │         │emailId, recipientEmail, status='scheduled', scheduledTime
    │         │+ batchId for grouping
    │
    └─ 4. Schedule jobs in queue
         │
         ▼
[BullMQ Queue]
    │
    ├─ FOR each recipient:
    │   ├─ CREATE job with delay = (index × delayMs)
    │   ├─ jobId = emailId (prevents duplicates)
    │   └─ STORE in Redis
    │
    └─ Job example:
       ├─ id: "email-123"
       ├─ data: {emailId, senderId, recipientEmail, subject, body}
       ├─ delay: 5000  (milliseconds until run)
       └─ attempts: 3
             │
             ▼
[Return Response]
    │
    └─ {success: true, batchId, emailCount, jobIds[], startTime}
```

### 2. Job Processing Flow

```
Redis Timer
    │
    ├─ Every 100ms, check for due jobs
    │
    └─ IF job.delay <= 0:
           │
           ▼
[BullMQ Worker] (up to 10 in parallel)
    │
    ├─ 1. Get job from queue
    ├─ 2. Extract: emailId, senderId, recipientEmail, subject, body
    │
    └─ 3. Check Rate Limit
           │
           ├─ Call: rateLimitService.checkAndIncrementRateLimit(senderId)
           │
           └─ Redis Key: rate_limit:{senderId}:{hourTimestamp}
                │
                ├─ INCR rate_limit_count
                ├─ IF count > MAX_PER_HOUR:
                │      │
                │      ├─ Reschedule job to next hour
                │      └─ RETURN 'rescheduled'
                │
                └─ CONTINUE if count <= MAX
                     │
                     ▼
           4. Apply Minimum Delay
                │
                └─ Sleep for MIN_DELAY_BETWEEN_EMAILS_MS (e.g., 1000ms)
                     │
                     ▼
           5. Send Email via SMTP
                │
                ├─ Connect: Ethereal Email (fake SMTP)
                ├─ From: sender@domain.com
                ├─ To: recipient@example.com
                ├─ Subject, Body
                │
                └─ IF success:
                     │
                     ▼
           6. Update Database (Prisma)
                │
                ├─ UPDATE scheduled_emails
                │   SET status = 'sent'
                │   SET sentTime = NOW()
                │   SET bullJobId = job.id
                │   WHERE id = emailId
                │
                └─ Job removed from queue (completed)
                     │
                     ▼
           DONE - Email sent successfully
```

### 3. Persistence on Restart

```
Before Restart:
┌─────────────────────────────────┐
│  In-Memory State (LOST)         │
│  ├─ Worker instance             │
│  ├─ Current processing          │
│  └─ Temp variables              │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Redis (PERSISTENT)             │
│  ├─ All queued jobs             │
│  ├─ Job state (pending/active)  │
│  ├─ Rate limit counters         │
│  └─ Retry information           │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  PostgreSQL (PERSISTENT)        │
│  ├─ All scheduled_emails        │
│  ├─ Status (scheduled/sent)     │
│  ├─ Timestamps                  │
│  └─ Failure reasons             │
└─────────────────────────────────┘
              │
              │ Server Restart
              ▼
[Server Starts]
    │
    ├─ Connect to PostgreSQL
    ├─ Connect to Redis
    │
    └─ Reconnect BullMQ Worker
           │
           └─ Worker reads Redis
               │
               ├─ Find all pending jobs (not completed)
               ├─ Resume from exact point
               ├─ Recalculate delays from NOW
               │
               └─ IF delay already passed:
                   └─ Run immediately
                     │
                     ▼
              Jobs continue processing as if never stopped
              └─ No re-run from start
                 No duplicates
                 Exact scheduled times preserved
```

## Rate Limiting Architecture

### Strategy: Per-Sender Hourly Limit

```
Requirement: 200 emails/hour per sender

Scenario: Schedule 250 emails in batch for 10:00 AM
         └─ Sender: sender@example.com
         └─ Limit: 200/hour
```

### Implementation

```
Hour 1 (10:00 - 10:59)
├─ Emails 1-200 scheduled
├─ Each gets delay 0-1000ms
└─ All process between 10:00-10:01

Hour 2 (11:00 - 11:59)
├─ Emails 201-250 rescheduled
├─ Each gets delay 3600000-3601000ms (1 hour later)
└─ Process between 11:00-11:01
```

### Rate Limit Check Code

```typescript
// In worker before SMTP send:

async checkAndIncrementRateLimit(senderId: string): boolean {
  const now = new Date();
  
  // Create key unique to this hour
  const hourTimestamp = now.getTime() - (now.getTime() % (1000*60*60));
  const hourKey = `rate_limit:${senderId}:${hourTimestamp}`;
  
  // Atomic increment
  const count = await redis.incr(hourKey);
  
  // Set expiry (1 hour = 3600 seconds)
  if (count === 1) {
    await redis.expire(hourKey, 3600);
  }
  
  const maxPerHour = 200;
  
  if (count > maxPerHour) {
    // RATE LIMIT HIT
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1);
    
    // Reschedule
    await queue.add(jobData, {
      delay: nextHour.getTime() - Date.now()
    });
    
    return false; // Don't send now
  }
  
  return true; // OK to send
}
```

### Why This Approach

✅ **Atomic**: Redis `INCR` is atomic - no race conditions
✅ **Distributed**: Works across multiple worker instances
✅ **Accurate**: Respects hour boundaries
✅ **Efficient**: O(1) operation per email
✅ **Graceful**: Preserves order, doesn't drop emails

---

## Concurrency Model

### BullMQ Worker Configuration

```typescript
new Worker('email', jobProcessor, {
  concurrency: 10,  // Up to 10 jobs simultaneously
  connection: redisConnection,
});
```

### What "Concurrency: 10" Means

```
Time   Worker 1    Worker 2    Worker 3   Worker 4   Worker 5...10
─────  ────────    ────────    ────────   ────────   ──────────
T0     Job A       Job B       Job C      Job D      Job E,F,G,H,I,J
         |           |           |         |         |
T0-1s  Sleep        Sleep       Sleep     Sleep      Sleeping
       (1000ms)     (1000ms)    (1000ms)  (1000ms)   (1000ms)
         |           |           |         |         |
T1     SEND A       SEND B      SEND C    SEND D     SEND E,F,G,H,I,J
         |           |           |         |         |
T1-3s  Wait for     Wait for    Wait for  Wait for   Waiting for
       SMTP reply   SMTP reply  SMTP reply SMTP reply replies

T4     Job K       Job L       Job M      Job N      Job O,P,Q,R,S,T
       (from queue)
```

**Example Timeline with 250 emails, concurrency=10, delay=1000ms**:

```
Time     Active Jobs  Total Sent  Rate
────────────────────────────────────
0:00s    Job 1-10         0      0/s
1:00s    Job 11-20       10      10/s
2:00s    Job 21-30       20      10/s
...
25:00s   Job 241-250     240     9.6/s
26:00s   -              250      Done
```

---

## Database Schema Design

### Users Table

```sql
CREATE TABLE users (
  id       STRING PRIMARY KEY,
  email    STRING UNIQUE,
  name     STRING,
  avatar   STRING,           -- Profile pic URL
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);
```

**Why**:
- Tracks authenticated users
- Avatar for UI display
- Unique email prevents duplicates

### Senders Table

```sql
CREATE TABLE senders (
  id        STRING PRIMARY KEY,
  userId    STRING FOREIGN KEY,
  email     STRING,          -- From address
  name      STRING,          -- From name
  createdAt TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(userId, email)      -- User can have multiple senders
);
```

**Why**:
- Allows multiple senders per user (e.g., sales@, support@)
- Enables per-sender rate limiting
- Tracks sender metadata

### ScheduledEmails Table

```sql
CREATE TABLE scheduled_emails (
  id             STRING PRIMARY KEY,
  userId         STRING FOREIGN KEY,
  senderId       STRING FOREIGN KEY,
  recipientEmail STRING,
  subject        STRING,
  body           TEXT,             -- HTML body
  scheduledTime  TIMESTAMP,        -- When to send
  sentTime       TIMESTAMP NULL,   -- When actually sent
  status         STRING,           -- scheduled|sent|failed
  failureReason  STRING NULL,      -- Error message
  bullJobId      STRING NULL,      -- Job ID in BullMQ
  batchId        STRING,           -- Group from same request
  createdAt      TIMESTAMP DEFAULT NOW(),
  updatedAt      TIMESTAMP DEFAULT NOW(),
  
  INDEX(userId),                   -- Query by user
  INDEX(status),                   -- Query by status
  INDEX(scheduledTime),            -- Query by time
  INDEX(batchId)                   -- Query by batch
);
```

**Why**:
- `scheduledTime` for UI sorting
- `sentTime` to prove when sent
- `status` for dashboard filtering
- `batchId` to group related emails
- `bullJobId` to link to Redis job

### EmailBatch Table

```sql
CREATE TABLE email_batches (
  id        STRING PRIMARY KEY,
  userId    STRING FOREIGN KEY,
  subject   STRING,
  body      TEXT,
  recipients STRING[],        -- Array of email addresses
  startTime TIMESTAMP,
  delayMs   INT,
  hourlyLimit INT,
  createdAt TIMESTAMP DEFAULT NOW()
);
```

**Why**:
- Stores batch metadata
- Useful for bulk operations
- Audit trail

---

## API Response Schema

### Schedule Email Response

```json
{
  "success": true,
  "batchId": "batch-uuid",
  "emailCount": 100,
  "jobIds": ["job1", "job2", ...],
  "startTime": "2024-02-01T10:00:00Z"
}
```

### Scheduled Emails Response

```json
{
  "emails": [
    {
      "id": "email-uuid",
      "recipientEmail": "user@example.com",
      "subject": "Welcome",
      "scheduledTime": "2024-02-01T10:00:00Z",
      "status": "scheduled",
      "sender": {
        "name": "Sender Name",
        "email": "sender@domain.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 250,
    "pages": 13
  }
}
```

---

## Error Handling

### Job Retry Strategy

```
Attempt 1: Send email
├─ If SUCCESS → Mark as sent ✓
└─ If FAILED → Retry after 2s

Attempt 2: Send email (after 2s)
├─ If SUCCESS → Mark as sent ✓
└─ If FAILED → Retry after 4s (exponential backoff)

Attempt 3: Send email (after 4s)
├─ If SUCCESS → Mark as sent ✓
└─ If FAILED → Mark as FAILED, log error
```

### Graceful Degradation

```
Level 1: SMTP Error
├─ Log error
├─ Retry up to 3 times
└─ Mark as failed if all attempts fail

Level 2: Rate Limit Hit
├─ Don't mark as failed
├─ Reschedule to next hour
└─ Log reschedule reason

Level 3: Database Error
├─ Log error
├─ Keep job in queue
├─ Will retry when DB comes back
└─ No data loss

Level 4: Server Crash
├─ All jobs stay in Redis
├─ Auto-resume on restart
├─ No emails lost or duplicated
└─ Exact schedule preserved
```

---

## Performance Optimizations

### 1. Job Batch Insert

```typescript
// Instead of N INSERT statements:
await prisma.scheduledEmail.createMany({
  data: [
    {id, userId, senderId, ...},
    {id, userId, senderId, ...},
    // ... 100 records
  ],
  skipDuplicates: false
});
// ~100x faster than individual inserts
```

### 2. Indexed Queries

```sql
-- Indexes optimize these queries:
SELECT * FROM scheduled_emails WHERE userId = ? AND status = 'scheduled'
SELECT * FROM scheduled_emails WHERE status = 'sent' ORDER BY sentTime DESC
SELECT * FROM scheduled_emails WHERE scheduledTime > NOW()
```

### 3. Connection Pooling

```typescript
// Prisma auto-pools connections
const prisma = new PrismaClient({
  log: ['error', 'warn'],
  // Prisma manages connection pool internally
});

// Typical: 5-20 connections based on load
```

### 4. Redis Persistence

```yaml
# docker-compose.yml
redis:
  volumes:
    - redis_data:/data  # Persists to disk
```

---

## Scaling Considerations

### Horizontal Scaling

**Current**: 1 backend, 1 worker

**Scaled**: N backends, N workers (all connected to same Redis + DB)

```
┌─────────────────────────────────────┐
│  Load Balancer (nginx)              │
├─────────────────────────────────────┤
│ Instance 1 (Backend + Worker)       │
│ Instance 2 (Backend + Worker)       │
│ Instance 3 (Backend + Worker)       │
└──────────────┬──────────────────────┘
               │
        ┌──────┴─────┐
        │             │
    ┌────────┐   ┌───────┐
    │ Redis  │   │ PG DB │
    │(Shared)│   │(Shared)│
    └────────┘   └───────┘
```

**How it works**:
- Multiple workers compete for jobs from same Redis queue
- BullMQ handles distributed locking
- Database ensures consistency
- No duplication or conflict

### Vertical Scaling

Increase single instance resources:
- CPU: Up to 16 cores
- RAM: Up to 32GB
- Concurrency: 50-100 jobs/instance

---

## Testing Strategy

### Unit Tests

```typescript
// Test: Rate limit service
describe('rateLimitService', () => {
  it('should allow emails under limit', async () => {
    const canSend = await rateLimitService.checkAndIncrementRateLimit('sender1');
    expect(canSend).toBe(true);
  });
  
  it('should reject emails over limit', async () => {
    // Pre-fill to 200
    for (let i = 0; i < 200; i++) {
      await rateLimitService.checkAndIncrementRateLimit('sender1');
    }
    
    const canSend = await rateLimitService.checkAndIncrementRateLimit('sender1');
    expect(canSend).toBe(false);
  });
});
```

### Integration Tests

```typescript
// Test: Full email scheduling flow
describe('Email Scheduling', () => {
  it('should schedule and send emails', async () => {
    // 1. POST /api/emails/schedule
    const response = await api.post('/emails/schedule', {
      recipients: ['test@example.com'],
      startTime: new Date(),
      // ...
    });
    
    // 2. Verify in DB
    const email = await db.scheduledEmail.findUnique({
      where: {id: response.emailId}
    });
    expect(email.status).toBe('scheduled');
    
    // 3. Wait for processing
    await sleep(2000);
    
    // 4. Verify sent
    const sent = await db.scheduledEmail.findUnique({
      where: {id: response.emailId}
    });
    expect(sent.status).toBe('sent');
  });
});
```

### Load Tests

Using k6 or Apache Bench to simulate:
- 1000+ concurrent users
- 100+ emails/second
- Verify no memory leaks
- Verify queue accuracy

---

## Security Considerations

### Authentication

✅ **Google OAuth** - Industry standard, zero password storage
✅ **Session Tokens** - Base64 encoded user ID (in production, use JWT)
❌ **NO credentials** stored in memory

### Authorization

✅ **User isolation** - Users can only see their own emails
✅ **Sender validation** - Only own senders can send
❌ **NO cross-user access** possible

### Data Protection

✅ **HTTPS** (in production) - Encrypt in transit
✅ **SQL injection prevention** - Prisma ORM parameterizes
✅ **Rate limiting** - Email limit prevents abuse

### SMTP Security

✅ **Ethereal Email** - Dev/test use only
✅ **Production**: Use SendGrid, Mailgun, etc.
❌ **Never log passwords** in console

---

## Monitoring & Observability

### Key Metrics to Track

```
1. Queue Health
   ├─ Jobs waiting
   ├─ Jobs active
   └─ Jobs failed

2. Performance
   ├─ Avg send time per email
   ├─ P95 latency
   └─ Throughput (emails/second)

3. Reliability
   ├─ Success rate (%)
   ├─ Failure rate (%)
   └─ Retry count
```

### Log Patterns

```typescript
// Good logs
console.log(`✓ Email sent to ${email} (${duration}ms)`);
console.error(`✗ Send failed: ${error.message}`);
console.log(`Rate limit hit, rescheduled to ${nextHour}`);

// Bad logs (too verbose)
console.log('Email', email, 'Status', status, 'Time', time);
```

---

## Summary

This architecture provides:

✅ **Reliability** - Persistence, retries, error handling
✅ **Scalability** - Event-driven, distributed workers
✅ **Performance** - Concurrent processing, optimized DB queries
✅ **Maintainability** - Clean separation, documented patterns
✅ **Flexibility** - Configurable limits, delays, concurrency
✅ **Observability** - Logs, metrics, debugging tools

Perfect for a production email system! 🚀
