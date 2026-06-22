# Zett

Build agents faster than the speed of light.

```
npx zett@latest init my-agent
```

```
my-agent/
├── agent/
│   ├── agent.ts           # model + Cencori config
│   ├── instructions.md    # system prompt
│   ├── tools/             # what it can do
│   ├── knowledge/         # what it knows
│   ├── subagents/         # who it delegates to
│   ├── channels/          # where it lives (HTTP, Slack, etc.)
│   ├── schedules/         # when it acts on its own
│   ├── sessions/          # durable execution policies
│   └── policies/          # security, budgets, guardrails
├── package.json
└── tsconfig.json
```

## Quick Start

```bash
npx zett@latest init my-agent
cd my-agent
npm run dev
```

## Authoring

```ts
// agent/agent.ts
import { defineAgent } from "zett";

export default defineAgent({
  model: "claude-sonnet-4-5",
  cencori: {
    project: "proj_abc",
    billing: { budget: "50.00/month" },
  },
});
```

```ts
// agent/tools/get_weather.ts
import { defineTool } from "zett/tools";
import { z } from "zod";

export default defineTool({
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  async execute({ city }) {
    return { city, condition: "Sunny", temperatureF: 72 };
  },
});
```

## License

MIT
