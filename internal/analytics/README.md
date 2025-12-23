# Cencori Platform Analytics

> Internal analytics system for tracking platform-wide metrics.

## Overview

This module provides comprehensive analytics for the Cencori platform, tracking:

- **AI Gateway**: Requests, costs, tokens, latency, provider/model breakdown
- **Security**: Incidents by type and severity
- **Organizations**: Total, active, by tier
- **Projects**: Total, active, by status
- **API Keys**: Total, active, by environment
- **Users**: Signups, active users
- **Billing**: Subscriptions, MRR

## Extraction Guide

To use this module in another repo:

1. Copy the entire `/internal/analytics/` directory
2. Copy the API routes from `/app/api/internal/` 
3. Install dependencies: `@tanstack/react-query`, `recharts`
4. Set up Supabase client connection
5. Configure admin authentication

## File Structure

```
internal/analytics/
├── README.md           # This file
├── api/                # API route handlers
├── components/         # React components
├── hooks/              # React Query hooks
├── lib/                # Utilities and types
└── pages/              # Page components
```

## Design System

Follows **Cenpact Design** (see `/DESIGN_PLAYBOOK.md`):
- Dense typography: `text-[10px]` labels, `text-xs` body
- Cards: `rounded-xl border border-border/50 bg-card p-5`
- Emerald accents for success metrics
- Dark mode native
