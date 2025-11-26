![Cencori by FohnAI](public/Bonus.png)

# Cencori

**The Security Layer for AI Development**

Build with AI. Deploy with confidence.

Cencori is a developer-first AI infrastructure platform that wraps your AI integrations with security, compliance, and observability - so you can ship AI features without worrying about data leaks, compliance violations, or runaway costs.

---

## Why Cencori?

If you're building with AI or building AI products, you need:

- **Security** - Automatic PII detection and filtering
- **Compliance** - Audit logs and safety scores for every request
- **Cost Control** - Rate limiting and usage analytics
- **Observability** - Real-time dashboards and request tracking
- **Multi-tenancy** - Organization and project management built-in

**Cencori gives you all of this in one platform.**

---

## Quick Start

### 1. Install the SDK

```bash
npm install cencori
```

### 2. Get Your API Key

1. Sign up at [cencori.com](https://cencori.com)
2. Create a project
3. Generate an API key

### 3. Make Your First Request

```typescript
import { Cencori } from 'cencori';

const ai = new Cencori('your-api-key');

const response = await ai.chat({
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log(response.content);
```

**That's it!** Cencori handles security, logging, and cost tracking automatically.

---

## Key Features

### **Built-in Security**

Every request goes through automatic safety filters:
- **PII Detection** - Blocks emails, phone numbers, SSNs, credit cards
- **Content Safety** - Filters harmful keywords and prompt injection attempts
- **Safety Scores** - Every request gets a safety score for compliance

### **Real-time Analytics**

Track everything in your dashboard:
- Request counts by time period
- Cost tracking per project
- Latency monitoring
- Error rates and filtering stats

### **Flexible API Keys**

- **Production Keys** - For live applications (`cen_...`)
- **Test Keys** - For development (`cen_test_...`)
- Environment-based data isolation
- Easy key rotation

### **Rate Limiting**

Database-backed rate limiting (60 requests/min per project) prevents abuse and controls costs.

### **Complete Audit Logs**

Every request is logged with:
- Timestamp and user
- Request/response payloads
- Token usage and cost
- Safety scores and filter results

---

## Who Is Cencori For?

### For Developers Using AI Tools
Building with Cursor, Lovable, Bolt, v0, or Windsurf?

**Cencori helps you:**
- Ship AI features faster with security built-in
- Catch issues AI-generated code might miss
- Move from prototype to production safely

### For AI Product Companies
AI design tools, AI coding assistants, AI marketing platforms, AI customer support bots, AI legal research tools, AI medical diagnostic systems, AI financial advisors, AI content generation tools, AI language translation services, AI data analysis platforms, AI cybersecurity solutions, AI educational tutors, AI gaming, AI robotics control, AI fashion design tools?

**Cencori provides:**
- Enterprise-grade security your customers demand
- Ready-made compliance story for B2B sales
- Infrastructure so you can focus on product

---

## Architecture

Cencori is built on a modern, scalable stack:

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 15 (App Router) | Full-stack platform |
| **Auth & Database** | Supabase | Authentication & data |
| **Language** | TypeScript | Type-safe development |
| **Deployment** | Vercel | Hosting & CI/CD |
| **AI Models** | Google | Primary AI provider (Until the official FohnAI model is ready) |

---

## API Reference

### Chat Endpoint

```typescript
POST /api/ai/chat
Headers: { "CENCORI_API_KEY": "your-api-key" }
Body: {
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
}
```

### Response

```json
{
  "content": "Hello! How can I help you?",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  },
  "cost_usd": 0.000025
}
```

**[Full API Documentation](https://cencori.com/docs)**

---

## Development Setup

### Prerequisites

- Node.js 18+
- A Supabase project (free tier works)
- Gemini API key

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/bolaabanjo/cencori.git
   cd cencori
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   GEMINI_API_KEY=your_gemini_api_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

---

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | AI Gateway MVP | Complete |
| **Phase 2** | Multi-model support | In Progress |
| **Phase 3** | Advanced analytics | Planned |
| **Phase 4** | Enterprise features | Planned |

### Coming Soon

- Support for OpenAI, Anthropic, and more AI providers
- Custom safety rules and filter configuration
- Team collaboration features
- Webhook notifications
- Advanced cost optimization

---

## Contributing

We welcome contributions! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes and add tests
4. Submit a pull request

Please follow our coding standards and include tests for new features.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Support

- **Email:** support@cencori.com
- **Docs:** [cencori.com/docs](https://cencori.com/docs)
- **Issues:** [GitHub Issues](https://github.com/bolaabanjo/cencori/issues)

---

**Built by FohnAI**

*Making AI development safe, compliant, and trustworthy.*