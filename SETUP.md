# Setup & Installation Guide

Complete step-by-step guide to get the ReachInbox Email Scheduler running.

## Prerequisites

- **Node.js 18+** - Download from https://nodejs.org/
- **Docker & Docker Compose** - For PostgreSQL and Redis
  - Windows: https://www.docker.com/products/docker-desktop
  - Mac/Linux: Follow official Docker documentation
- **Git** - For cloning the repository
- **Google OAuth credentials** - See "Google OAuth Setup" section below
- **Code editor** - VS Code recommended

## Installation Steps

### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd reachinbox
```

### Step 2: Start Docker Services

Start PostgreSQL and Redis containers:

```bash
# Start containers in background
docker-compose up -d

# Verify services are running
docker-compose ps

# You should see:
# STATUS: Up (Healthy)
```

Verify containers are healthy:

```bash
# Check logs
docker-compose logs

# If you see connection refused, wait a moment and try again
```

### Step 3: Backend Setup

Navigate to backend directory and install dependencies:

```bash
cd backend

# Install npm dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev --name init

# When prompted, press Enter to accept
```

Create and configure `.env` file:

```bash
# Copy example file
cp .env.example .env
```

Edit `.env` with your Ethereal Email credentials:

```env
DATABASE_URL="postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_scheduler"
REDIS_URL="redis://localhost:6379"
PORT=3001
NODE_ENV="development"

# Sign up for free at https://ethereal.email/
# You'll get fake SMTP credentials
ETHEREAL_EMAIL="your_ethereal_email@ethereal.email"
ETHEREAL_PASSWORD="your_ethereal_password"

# Rate limiting settings
MAX_EMAILS_PER_HOUR_GLOBAL=500
MAX_EMAILS_PER_HOUR_PER_SENDER=200
MIN_DELAY_BETWEEN_EMAILS_MS=1000

# Worker settings
WORKER_CONCURRENCY=10
```

### Step 4: Get Ethereal Email Credentials

1. Go to https://ethereal.email/
2. Click "Create Ethereal Account"
3. Fill in a username and password (any value)
4. You'll get SMTP credentials - copy them
5. Paste the credentials in your `.env` file

Example Ethereal response:
```
User: testuser@ethereal.email
Pass: testpass123
```

### Step 5: Start the Backend Server

```bash
# From the backend directory
npm run dev

# You should see:
# ✓ Database connected
# ✓ Redis connected
# ✓ Email worker initialized
# 🚀 Server running on http://localhost:3001
```

Keep this terminal open. The server is now running.

### Step 6: Frontend Setup

Open a NEW terminal and navigate to frontend:

```bash
cd frontend

# Install npm dependencies
npm install

# Create environment file
cp .env.example .env
```

Edit `.env` file - you'll need a Google OAuth client ID.

### Step 7: Setup Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (if you don't have one)
3. Enable the Google+ API:
   - Search for "Google+ API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "Credentials" in left sidebar
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - Add authorized JavaScript origins:
     - `http://localhost:3000`
   - Add authorized redirect URIs:
     - `http://localhost:3000/`
   - Click "Create"
5. Copy the "Client ID" (not the secret)
6. Add to `.env` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_copied_client_id_here
```

### Step 8: Start the Frontend Server

From the frontend directory:

```bash
npm run dev

# You should see:
# ▲ Next.js 14.0.4
# - Local:        http://localhost:3000
```

### Step 9: Access the Application

1. Open your browser
2. Navigate to http://localhost:3000
3. Click "Sign in with Google"
4. Log in with your Google account
5. You're in! 🎉

## Testing the System

### 1. Schedule Test Emails

From the dashboard:

1. Click "Compose New Email"
2. Fill in the form:
   - From Email: `test@example.com`
   - From Name: `Test Sender`
   - Subject: `Hello World`
   - Body: `<p>This is a test email</p>`
3. Upload a CSV file with email addresses (see CSV Format below)
4. Set start time to 2 minutes from now
5. Click "Schedule Emails"

### CSV Format

Create a file named `recipients.csv`:

```csv
email
test1@example.com
test2@example.com
test3@example.com
```

Or with headers:

```csv
Email Address
user1@test.com
user2@test.com
```

### 2. Watch Emails Get Sent

1. Go to "Scheduled Emails" tab
2. You'll see all scheduled emails
3. After the scheduled time, they move to "Sent Emails" tab
4. Click "Refresh" to update the view

### 3. Test Rate Limiting

1. Schedule 250 emails for the same hour (limit is 200)
2. Expected behavior:
   - First 200 send in hour 1
   - Remaining 50 reschedule to hour 2
   - No duplicates
   - All eventually sent

## Troubleshooting

### Backend Issues

**Error: "ECONNREFUSED 127.0.0.1:5432"**
- PostgreSQL is not running
- Solution: `docker-compose ps` and `docker-compose up -d`

**Error: "ECONNREFUSED 127.0.0.1:6379"**
- Redis is not running
- Solution: `docker-compose ps` and `docker-compose up -d`

**Error: "Prisma Client not generated"**
- Solution: `npx prisma generate`

**Error: "Database migration failed"**
- Solution: `npx prisma migrate reset` (WARNING: deletes all data)

### Frontend Issues

**Error: "CORS error" or "Network error"**
- Backend not running on port 3001
- Wrong API_URL in `.env`
- Solution: Check backend is running with `npm run dev`

**Error: "Google login not working"**
- Wrong Google Client ID in `.env`
- Client ID not authorized for `localhost:3000`
- Solution: Check Google Cloud Console OAuth settings

**Page is blank / not loading**
- Next.js build failed
- Solution: Check terminal for errors, try `npm run dev` again

### Docker Issues

**Error: "Port already in use"**
- Another service using port 5432 or 6379
- Solution: 
  ```bash
  # Stop all containers
  docker-compose down
  
  # Or run on different ports by editing docker-compose.yml
  ```

**Error: "Cannot connect to Docker daemon"**
- Docker Desktop not running
- Solution: Start Docker Desktop

## Development Commands

### Backend

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Start production build
npm start

# Database management
npx prisma studio         # Open Prisma Studio
npx prisma migrate dev    # Create new migration
npx prisma migrate reset  # Reset database (⚠️ deletes data)
```

### Frontend

```bash
# Development with hot reload
npm run dev

# Build for production
npm run build

# Start production build
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

# Restart services
docker-compose restart

# View specific service logs
docker-compose logs postgres
docker-compose logs redis
```

## Production Deployment

### Environment Setup

Change `.env` values for production:

```env
NODE_ENV=production
DATABASE_URL=postgresql://prod_user:prod_pass@prod_host:5432/db
REDIS_URL=redis://prod_redis_host:6379
```

### Build & Deploy Backend

```bash
cd backend
npm run build
npm start
```

### Build & Deploy Frontend

```bash
cd frontend
npm run build
npm start
```

### Using PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Start backend with PM2
cd backend
pm2 start "npm start" --name "reachinbox-backend"

# Start frontend with PM2
cd frontend
pm2 start "npm start" --name "reachinbox-frontend"

# View status
pm2 status

# View logs
pm2 logs
```

### Docker Production Setup

Create a production `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis_data:/data

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres:5432/reachinbox
      REDIS_URL: redis://redis:6379
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - redis
    restart: always

  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001/api
      NEXT_PUBLIC_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: always

volumes:
  postgres_data:
  redis_data:
```

## Database Backups

### PostgreSQL Backup

```bash
# Create backup
docker-compose exec postgres pg_dump -U reachinbox reachinbox_scheduler > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U reachinbox reachinbox_scheduler < backup.sql
```

### Redis Backup

```bash
# Create backup
docker-compose exec redis redis-cli BGSAVE

# Check backup location
docker-compose exec redis redis-cli CONFIG GET dir
```

## Performance Tuning

### Increase Worker Concurrency

Edit `.env`:

```env
# Run up to 20 jobs in parallel
WORKER_CONCURRENCY=20
```

Higher = more concurrent emails, but more server resources.

### Increase Rate Limit

```env
# Allow 500 emails per hour per sender
MAX_EMAILS_PER_HOUR_PER_SENDER=500
```

### Decrease Delay Between Emails

```env
# Reduce delay to 500ms between emails
MIN_DELAY_BETWEEN_EMAILS_MS=500
```

## Monitoring

### View Queue Status

API Endpoint: `GET /api/emails/stats`

```bash
curl -H "x-user-id: YOUR_USER_ID" \
  http://localhost:3001/api/emails/stats
```

### View Database

Open Prisma Studio:

```bash
cd backend
npx prisma studio
```

### View Redis

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# View all keys
KEYS *

# View specific queue
LLEN bull:email:1:job:active
```

## Getting Help

If you encounter issues:

1. Check the troubleshooting section above
2. Check application logs:
   - Backend terminal where `npm run dev` runs
   - Frontend browser console (F12)
3. Check Docker logs: `docker-compose logs`
4. Check PostgreSQL: Open Prisma Studio with `npx prisma studio`
5. Check Redis: Use `docker-compose exec redis redis-cli`

## Next Steps

After setup is complete:

1. Explore the dashboard
2. Test email scheduling
3. Monitor queue performance
4. Experiment with rate limiting
5. Try the restart scenario to verify persistence
6. Review the code architecture

Happy scheduling! 🚀
