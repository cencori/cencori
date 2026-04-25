# create-cencori-app

Create a new AI app powered by [Cencori](https://cencori.com) in seconds.

## Usage

```bash
npx create-cencori-app my-project
```

That's it. The CLI will:

1. Ask you to pick a framework (Next.js or TanStack)
2. Scaffold a project with the Cencori SDK already wired up
3. Create an API route ready for AI chat
4. Set up a `.env.local` for your API key
5. Install dependencies

Open the project, drop in your API key from [cencori.com/dashboard](https://cencori.com/dashboard/organizations), and you're making AI requests in under 5 minutes.

## Options

```
Usage: create-cencori-app <project-name> [options]

Options:
  -t, --template <template>  Template to use (nextjs or tanstack)
  --no-chat                  Skip the demo chat UI component
  --no-install               Skip installing dependencies
  --api-key <key>            Pre-fill your Cencori API key
  -V, --version              Output the version number
  -h, --help                 Display help
```

## Templates

### Next.js

Full-stack React with App Router, Vercel AI SDK streaming, and server-side API routes.

```bash
npx create-cencori-app my-project --template nextjs
```

### TanStack

Lightweight React with Vite, TanStack Query, and the Cencori SDK.

```bash
npx create-cencori-app my-project --template tanstack
```

## What You Get

```
my-project/
├── app/api/chat/route.ts     ← AI chat route (ready to use)
├── components/chat.tsx       ← Demo chat UI (optional)
├── lib/cencori.ts            ← Shared Cencori client
├── cencori.config.ts         ← Model selection, settings
├── .env.local                ← Your API key goes here
└── ...
```

## Links

- [Cencori](https://cencori.com)
- [Documentation](https://cencori.com/docs)
- [SDK](https://github.com/cencori/cencori)

## License

MIT
