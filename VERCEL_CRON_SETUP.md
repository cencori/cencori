# Vercel Cron Setup Guide

## What Was Configured

Created `vercel.json` with a cron job that:
- Runs on the **1st of every month** at **midnight UTC**
- Calls `/api/cron/reset-usage` to reset all organization usage counters
- Uses cron expression: `0 0 1 * *`

## Cron Expression Breakdown

```
0 0 1 * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, Sunday = 0 or 7)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

So `0 0 1 * *` means: **Minute 0, Hour 0 (midnight), Day 1, Every month, Any day of week**

## Setup Steps

### 1. Add Environment Variable

You need to add `CRON_SECRET` to your Vercel project for security.

**Generate a secure secret:**
```bash
# On Mac/Linux:
openssl rand -base64 32

# On Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

# Or use any random string generator
```

**Add to Vercel:**
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add new variable:
   - **Name**: `CRON_SECRET`
   - **Value**: Your generated secret
   - **Environment**: Production (and optionally Preview/Development)
4. Click **Save**

### 2. Deploy to Vercel

The cron job will be automatically configured on your next deployment:

```bash
git add vercel.json
git commit -m "Add monthly usage reset cron job"
git push
```

Vercel will detect `vercel.json` and set up the cron automatically.

### 3. Verify Cron Setup

After deployment:

1. Go to your Vercel project dashboard
2. Click on **Cron Jobs** in the left sidebar (or **Settings → Cron Jobs**)
3. You should see:
   - Path: `/api/cron/reset-usage`
   - Schedule: `0 0 1 * *`
   - Status: Active

### 4. Test Manually (Optional)

Before waiting for the 1st of next month, you can test the endpoint manually:

**Using curl:**
```bash
curl -X POST https://your-domain.vercel.app/api/cron/reset-usage \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Or using Postman/Thunder Client:**
- Method: POST
- URL: `https://your-domain.vercel.app/api/cron/reset-usage`
- Headers:
  - `Authorization`: `Bearer YOUR_CRON_SECRET`

You should get a response like:
```json
{
  "success": true,
  "count": 5,
  "timestamp": "2025-12-02T04:30:00.000Z"
}
```

## Alternative: Test Locally

**In development mode ONLY**, the endpoint accepts GET requests:

```bash
# Local testing (won't work in production)
curl http://localhost:3000/api/cron/reset-usage
```

## Monitoring

### Check Cron Logs

After the cron runs (on the 1st of each month), check logs:

1. Vercel Dashboard → Your Project → **Functions**
2. Find `/api/cron/reset-usage`
3. Click to view execution logs

You should see:
```
[Cron] Starting monthly usage reset...
[Usage Reset] ✓ Reset 42 organization usage counters
[Cron] ✓ Successfully reset usage for 42 organizations
```

### Manual Trigger from Vercel Dashboard

You can also manually trigger the cron from the Vercel dashboard:

1. Go to **Cron Jobs**
2. Find your job
3. Click **Trigger Now** (useful for testing)

## Common Cron Schedules (For Reference)

If you want to change the schedule later:

| Schedule | Cron Expression | Description |
|----------|----------------|-------------|
| Every minute | `* * * * *` | Testing only! |
| Every hour | `0 * * * *` | Top of every hour |
| Every day at midnight | `0 0 * * *` | Daily reset |
| **Every 1st of month** | `0 0 1 * *` | **Current (Monthly)** |
| Every Monday at 9am | `0 9 * * 1` | Weekly reports |
| First day of year | `0 0 1 1 *` | Annual reset |

## Troubleshooting

### Cron Not Showing in Dashboard
- Make sure `vercel.json` is in the root directory
- Redeploy after adding the file
- Check Vercel build logs for errors

### 401 Unauthorized Error
- Check `CRON_SECRET` environment variable is set
- Verify the secret matches in both Vercel settings and your test requests
- Make sure to include `Bearer ` prefix in Authorization header

### Cron Not Running
- Check the schedule is correct
- Verify the path is exactly `/api/cron/reset-usage` (no trailing slash)
- Check Function Logs in Vercel dashboard for errors

## Next Deployment

When you push to production, Vercel will:
1. Detect the `vercel.json` file
2. Automatically configure the cron job
3. Start running it on schedule (1st of each month)

**No additional configuration needed!** ✅

---

## Quick Reference

**File Created**: `vercel.json`  
**Cron Schedule**: 1st of every month at midnight UTC  
**Endpoint**: `/api/cron/reset-usage`  
**Auth**: Requires `CRON_SECRET` env variable  
**Action**: Resets all `monthly_requests_used` to 0
