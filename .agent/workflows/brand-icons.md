---
description: How to add brand icons/logos to the codebase
---

# Brand Icons Workflow

## Source Package
**Always use `@lobehub/icons` for brand logos.**

Package: https://www.npmjs.com/package/@lobehub/icons
Docs: https://lobehub.com/icons

## Usage

```tsx
import { Cursor, OpenAI, Anthropic, Google } from '@lobehub/icons';

// Use with size prop
<Cursor size={24} />
<OpenAI size={32} />
```

## Current Setup

Brand icons are centralized in `/components/icons/BrandIcons.tsx`:

```tsx
// Re-export from @lobehub/icons
export { Cursor as CursorLogo } from "@lobehub/icons";

// Custom SVGs for icons not in lobehub
export function VercelLogo({ className, ...props }) { ... }
export function SupabaseLogo({ className, ...props }) { ... }
```

## Adding New Icons

1. Check if the icon exists in `@lobehub/icons`:
   ```tsx
   import { IconName } from '@lobehub/icons';
   ```

2. If not available, create a custom SVG component in `/components/icons/BrandIcons.tsx`

3. Always re-export from `BrandIcons.tsx` for consistency

## Available Icons in @lobehub/icons

Common ones: `Cursor`, `OpenAI`, `Anthropic`, `Google`, `Meta`, `Claude`, `Gemini`, `Mistral`, `Cohere`, `Perplexity`, etc.
