# Demo & Testing Guide

Step-by-step guide to demonstrate all features of the Email Scheduler.

## Demo Scenarios

### Scenario 1: Basic Email Scheduling

**Goal**: Schedule and send 3 emails with delay

**Steps**:

1. **Login to Dashboard**
   - Go to http://localhost:3000
   - Click "Sign in with Google"
   - Complete authentication

2. **Compose Email**
   - Click "Compose New Email"
   - Fill in form:
     - From Email: `test@example.com`
     - From Name: `Demo Sender`
     - Subject: `Welcome to ReachInbox`
     - Body: `<h1>Hello!</h1><p>This is a test email.</p>`

3. **Upload Recipients**
   - Create `recipients.csv`:
     ```csv
     email
     alice@example.com
     bob@example.com
     charlie@example.com
     ```
   - Click "Upload Recipients (CSV)"
   - Verify: "3 recipients detected"

4. **Schedule**
   - Start Time: Now + 1 minute
   - Delay Between (ms): 5000 (5 seconds)
   - Hourly Limit: 200
   - Click "Schedule Emails"

5. **Monitor Sending**
   - Go to "Scheduled Emails" tab
   - See 3 emails with "scheduled" status
   - After 1 minute, refresh the page
   - Emails should move to "Sent Emails" tab

**Expected Result**:
- 3 emails scheduled
- Sent in sequence with 5-second delays
- Status changes from "scheduled" → "sent"
- Timestamps recorded

---

### Scenario 2: Rate Limiting Demonstration

**Goal**: Show rate limiting with 250 emails (limit: 200/hour)

**Steps**:

1. **Create Test Data**
   - Create `large_batch.csv` with 250 recipients:
     ```csv
     email
     recipient1@example.com
     recipient2@example.com
     ...
     recipient250@example.com
     ```

2. **Schedule Large Batch**
   - Click "Compose New Email"
   - Fill in email details
   - Upload `large_batch.csv`
   - Set Start Time: Now + 2 minutes
   - Set Delay: 1000ms
   - Set Hourly Limit: 200
   - Click "Schedule Emails"

3. **Monitor Distribution**
   - Backend logs show:
     ```
     Email 1-200: Sending in hour 1
     Email 201-250: Rescheduled to hour 2 (3600 seconds later)
     ```

4. **Verify Scheduling**
   - Check "Scheduled Emails" tab
   - Note: Early emails have sooner scheduled times
   - Later emails have times ~1 hour later

**Expected Result**:
- First 200 emails scheduled in current hour
- Remaining 50 automatically rescheduled to next hour
- No emails dropped
- All eventually sent

---

### Scenario 3: Server Restart & Persistence

**Goal**: Demonstrate jobs survive server restart

**Steps**:

1. **Schedule Future Emails**
   - Schedule 5 emails for 5 minutes from now
   - Note: All show "scheduled" status
   - Don't wait for them to send yet

2. **Stop Backend Server**
   - Go to terminal where `npm run dev` is running
   - Press Ctrl+C to stop server
   - Wait 5 seconds

3. **Verify Data Persists**
   - PostgreSQL: Emails still in database ✓
   - Redis: Jobs still in queue ✓

4. **Restart Backend Server**
   - In same terminal, run `npm run dev` again
   - Backend restarts with logs:
     ```
     ✓ Database connected
     ✓ Redis connected
     ✓ Email worker initialized
     ```

5. **Monitor Sending**
   - Frontend: Refresh "Scheduled Emails" tab
   - Wait for scheduled time
   - Emails should still send on schedule
   - Check "Sent Emails" tab after scheduled time

**Expected Result**:
- Emails NOT resent from scratch
- Jobs resume from exact scheduled time
- No data loss
- No duplicate sends

---

### Scenario 4: Concurrency Testing

**Goal**: Show multiple emails processing in parallel

**Setup**:
```env
# In backend/.env
WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_EMAILS_MS=1000
```

**Steps**:

1. **Schedule 10 Emails**
   - Create batch with 10 recipients
   - Set Delay: 500ms (minimal)
   - Set Start Time: Now

2. **Watch Backend Logs**
   - Look for lines like:
     ```
     ✓ Email sent to recipient1@example.com
     ✓ Email sent to recipient2@example.com
     ✓ Email sent to recipient3@example.com
     ✓ Email sent to recipient4@example.com
     ✓ Email sent to recipient5@example.com
     ```
   - Multiple emails sending in parallel (up to 5 at once)

3. **Check Queue Stats**
   - Call API: `GET /api/emails/stats`
   - See active jobs count
   - Shows parallelism in action

**Expected Result**:
- Multiple emails processing simultaneously
- Up to 5 jobs running in parallel
- Much faster than sequential sending
- Configurable concurrency level

---

### Scenario 5: Error Handling

**Goal**: Test failure handling and retries

**Steps**:

1. **Schedule with Invalid SMTP** (optional test)
   - Temporarily change `ETHEREAL_PASSWORD` to wrong value
   - Schedule 2 emails
   - Watch them fail and retry

2. **Monitor Failures**
   - "Sent Emails" tab shows status
   - Failed emails have red badge
   - `failureReason` shows error message

3. **Check Database**
   - Open Prisma Studio: `npx prisma studio`
   - View `scheduled_emails` table
   - Status = "failed"
   - `failureReason` populated

4. **Restore SMTP Config**
   - Fix `ETHEREAL_PASSWORD` back
   - Restart backend

**Expected Result**:
- Failed emails tracked in database
- Error messages preserved
- UI shows failure status
- System gracefully handles errors

---

## API Testing with Postman

### 1. Login Endpoint

**POST** `/api/auth/google-login`

```json
{
  "email": "test@example.com",
  "name": "Test User",
  "picture": "https://example.com/avatar.jpg",
  "googleId": "123456789"
}
```

Response:
```json
{
  "success": true,
  "user": {
    "id": "clxxx...",
    "email": "test@example.com",
    "name": "Test User",
    "avatar": "https://example.com/avatar.jpg"
  },
  "token": "base64_encoded_token"
}
```

### 2. Schedule Emails

**POST** `/api/emails/schedule`

Headers:
```
x-user-id: <user_id_from_login>
Content-Type: application/json
```

Body:
```json
{
  "subject": "Test Email",
  "body": "<p>This is a test</p>",
  "recipients": [
    "recipient1@example.com",
    "recipient2@example.com"
  ],
  "startTime": "2024-02-15T10:00:00Z",
  "delayMs": 1000,
  "hourlyLimit": 200,
  "senderEmail": "sender@example.com",
  "senderName": "Test Sender"
}
```

### 3. Get Scheduled Emails

**GET** `/api/emails/scheduled?page=1&limit=20`

Headers:
```
x-user-id: <user_id>
```

### 4. Get Sent Emails

**GET** `/api/emails/sent?page=1&limit=20`

Headers:
```
x-user-id: <user_id>
```

### 5. Get Queue Stats

**GET** `/api/emails/stats`

Headers:
```
x-user-id: <user_id>
```

---

## Performance Benchmarks

### Test: Schedule 1000 Emails

**Configuration**:
- Delay between emails: 100ms
- Worker concurrency: 10
- Hourly limit: 500

**Execution**:

```bash
# Backend
WORKER_CONCURRENCY=10 npm run dev

# Create large CSV with 1000 recipients
# Schedule with start time: now

# Monitor
curl -H "x-user-id: YOUR_ID" http://localhost:3001/api/emails/stats
```

**Expected Results**:
- All 1000 jobs created in ~5 seconds
- Processing starts immediately
- First emails sent within 1 second
- Last emails sent ~100 seconds later (1000 * 100ms)
- No crashes or memory issues
- No duplicate sends

---

## Verification Checklist

Before considering complete, verify:

### ✅ Authentication
- [ ] Google OAuth login works
- [ ] User profile shows in header
- [ ] Logout clears session
- [ ] Redirect to login when not authenticated

### ✅ Email Scheduling
- [ ] Can compose email with subject and body
- [ ] Can upload CSV with recipients
- [ ] Recipient count displays correctly
- [ ] Can set start time and delays
- [ ] Can set hourly limit

### ✅ Dashboard
- [ ] Scheduled tab shows queued emails
- [ ] Sent tab shows processed emails
- [ ] Tables paginate correctly
- [ ] Refresh button updates data
- [ ] Empty states display when no data

### ✅ Persistence
- [ ] Emails in PostgreSQL survive restart
- [ ] Jobs in Redis resume after restart
- [ ] Scheduled times are accurate
- [ ] No duplicate sends after restart

### ✅ Rate Limiting
- [ ] Per-sender hourly limits enforced
- [ ] Excess emails reschedule to next hour
- [ ] Rate limit counts reset each hour
- [ ] Multiple senders independent limits

### ✅ Concurrency
- [ ] Multiple jobs process in parallel
- [ ] Configurable concurrency level
- [ ] Safe across multiple workers
- [ ] No race conditions

### ✅ Error Handling
- [ ] Failed emails show in sent tab
- [ ] Error messages recorded
- [ ] SMTP errors don't crash server
- [ ] Graceful error recovery

---

## Monitoring Queries

### PostgreSQL

```sql
-- Count emails by status
SELECT status, COUNT(*) FROM scheduled_emails GROUP BY status;

-- Recent emails
SELECT id, recipient_email, status, created_at 
FROM scheduled_emails 
ORDER BY created_at DESC 
LIMIT 10;

-- Count per sender
SELECT sender_id, COUNT(*) 
FROM scheduled_emails 
GROUP BY sender_id;

-- Failed emails
SELECT id, recipient_email, failure_reason 
FROM scheduled_emails 
WHERE status = 'failed';
```

### Redis

```bash
# Connect to Redis
docker-compose exec redis redis-cli

# View all keys
KEYS *

# Queue info
LLEN bull:email:*:job:active
LLEN bull:email:*:job:waiting
LLEN bull:email:*:job:completed

# Rate limit keys
KEYS rate_limit:*
```

### Backend Logs

```bash
# Follow logs in real-time
cd backend && npm run dev 2>&1 | tee logs.txt

# Search for patterns
grep "Email sent" logs.txt | wc -l  # Count sent emails
grep "Rate limit" logs.txt          # Find rate limit hits
grep "Failed" logs.txt              # Find failures
```

---

## Load Testing

### Using Apache Bench

```bash
# Install ab (comes with Apache)
# macOS: brew install httpd
# Ubuntu: apt-get install apache2-utils

# Test dashboard load
ab -n 100 -c 10 http://localhost:3000/

# Result should show response times and throughput
```

### Using k6

```bash
# Install k6
brew install k6  # macOS

# Create load test script: test.js
import http from 'k6/http';
import { check } from 'k6';

export let options = {
  vus: 10,
  duration: '30s',
};

export default function() {
  let res = http.get('http://localhost:3001/api/emails/stats', {
    headers: { 'x-user-id': 'test-user' },
  });
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
}

# Run test
k6 run test.js
```

---

## Troubleshooting During Demo

### Emails Not Sending

**Check**:
1. Backend server running? `npm run dev`
2. Redis/Postgres running? `docker-compose ps`
3. SMTP credentials correct? Check `.env`
4. Scheduled time in future? Should be 1+ minutes ahead

**Fix**:
```bash
# View backend logs
cd backend && npm run dev

# Check Redis
docker-compose exec redis redis-cli
> KEYS *  # See all keys
> LLEN bull:email:*:job:waiting  # Count pending jobs
```

### Emails Stuck in "Scheduled"

**Cause**: Worker not processing

**Fix**:
```bash
# Restart backend
Ctrl+C in backend terminal
npm run dev

# Check worker logs
```

### Rate Limiting Not Working

**Check**:
1. Scheduled emails > hourly limit?
2. Looking at console logs for "Rate limit reached"?

**Fix**:
```bash
# Reset rate limits
docker-compose exec redis redis-cli
> KEYS rate_limit:*
> DEL rate_limit:*
> EXIT
```

### Google OAuth Not Working

**Check**:
1. Correct Client ID in `.env`?
2. Client ID authorized for `localhost:3000`?
3. Network connectivity?

**Fix**:
```bash
# Check env variable
echo $NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Clear cookies
# Browser > Settings > Clear browsing data
```

---

## Demo Script (5 minutes)

**Total Time**: 5 minutes

1. **Login (30 seconds)**
   - Show Google login
   - Display user profile in header

2. **Compose Email (1 minute)**
   - Click "Compose New Email"
   - Show form with all fields
   - Upload 5-recipient CSV
   - Set time to 1 minute from now
   - Show queued count

3. **Monitor Dashboard (2 minutes)**
   - Switch to "Scheduled Emails"
   - Point out pending emails
   - Wait for schedule time
   - Refresh and show emails moving to "Sent"
   - Show sent email timestamps

4. **Show Restart (1.5 minutes)**
   - Quickly schedule future emails
   - Stop backend server
   - Show Redis still has jobs
   - Restart backend
   - Refresh dashboard
   - Show jobs still there and processing

5. **Rate Limiting (optional)**
   - If time permits, show batch of 250+ emails
   - Point out rescheduling in logs
   - Explain rate limit algorithm

---

Enjoy your demo! Questions? Check the main README.
