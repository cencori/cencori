# Agent UI starter

A Next.js app with an agent that answers with UI: charts, tables, stats, and an approval card before anything risky. Built with [Cencori](https://cencori.com): `cencori/agents` on the server, `<AgentChat>` from `cencori/react` in the page.

It's an assistant for an online store. Try:

- **How is revenue trending?** → a chart from `get_revenue`
- **Which orders still need shipping?** → a table from `get_orders`
- **Show me order 1044** → the order card that `show_order` returns, with a refund button
- **Refund order 1045** → an approval card; nothing is refunded until you approve

## Run it

```bash
npm install
cp .env.example .env.local   # add your CENCORI_API_KEY (a secret csk_ key)
npm run dev
```

Open http://localhost:3000.

## How it's put together

| File | What it does |
| --- | --- |
| `lib/agent.ts` | The agent: instructions, tools, `widgets: true` |
| `lib/store.ts` | Demo data. Replace these functions with your database |
| `app/api/chat/route.ts` | `createAgentChatHandler(storeAgent)`: serves the agent to the chat. Your tools run here |
| `app/page.tsx` | `<AgentChat api="/api/chat" />` |

- **Widgets.** `widgets: true` lets the model draw UI itself (`render_ui`). `show_order` instead returns its own `{ widget }`: a design you control, filled with real data.
- **Approvals.** `issue_refund` has `needsApproval: true`, so the chat shows an approval card first.
- **Any model.** The agent uses Cencori's default (GPT OSS 120B on Cerebras, fast). Set `model` on the agent to use any other: `claude-sonnet-4-5`, `gemini-2.5-flash`...
- **Traces.** Every conversation is in your Cencori project under **Observability → Traces**.

## Make it yours

- Put your own data behind the tools in `lib/store.ts`.
- Add auth in `app/api/chat/route.ts`: `createAgentChatHandler(agent, { context: async (req) => ({ userId: ... }) })`, and read `context` in your tools.
- Theme the chat: `<AgentChat theme={{ accent: '#2563eb', radius: 'lg' }} />`.

Docs: [Agent UI](https://cencori.com/docs/agent-ui/overview) · [Agents SDK](https://cencori.com/docs/agents-sdk/overview) · [Coming from OpenAI](https://cencori.com/docs/agents-sdk/migrate-from-openai)
