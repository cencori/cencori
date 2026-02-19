# Deep Dive: Dashboard UI State Management

The Cencori Dashboard (built on Next.js 15) relies on a highly decoupled, server-state-first architecture, bypassing traditional global state managers like Redux or Zustand.

## 1. Core State Philosophy

Cencori distinguishes strictly between **Server State** (database configurations, API keys, rules) and **Ephemeral UI State** (dropdowns toggle, local form input).

### The TanStack React Query Engine
For all Server State, the dashboard standardizes on `@tanstack/react-query`. 

**Why React Query?**
1. **Cache Synchronization**: Multiple components on the dashboard might need to know if a provider is active. React Query maintains a centralized cache key (`['provider-keys', projectId]`) that acts as the source of truth.
2. **Auto-Refetching**: Background refetches keep the UI consistent if a team member alters a setting elsewhere.
3. **Mutation Invalidation**: When a user updates a setting (e.g., in `ProviderKeyManager.tsx`), the mutation's `onSuccess` callback simply calls `queryClient.invalidateQueries`. This triggers an automatic re-render of all dependent components without brittle state passing.

## 2. Component Case Studies

### A. Provider Key Manager (`ProviderKeyManager.tsx`)
This component handles the "Bring Your Own Key" (BYOK) flow.
- **Fetching**: Retrieves the current API key status securely (boolean `hasKey`, entirely omitting the actual key from the payload unless needed for a hint).
- **Mutations**: POSTs to `/api/projects/[id]/provider-keys`. 
- **Encryption**: Keys are encrypted at the API layer using the organization ID as a salt/key reference (`encryptApiKey`).
- **State Buffer**: Ephemeral state (like `showKey` or selecting a default model temporarily in the dialog) is strictly managed via standard React `useState`, never leaking into global scope.

### B. Security Settings (`SecuritySettings.tsx`)
This handles complex toggles for `Cencori Scan` (PII, NSFW, Jailbreaks) and IP Allowlisting.
- **Local Edit Buffer**: The component uses a pattern where `localSettings` acts as a temporary buffer for unsaved changes.
- **Merging**: The UI renders a merged object: `const currentSettings = { ...fetchedSettings, ...localSettings }`.
- **Batching**: Changes aren't automatically pushed. The user must explicitly hit "Save", which flushes `localSettings` via a `PUT` mutation and then clears the buffer on success.

## 3. Provider Override Flow

When a user sets a "Default Model" in `ProviderKeyManager.tsx`:
1. The dashboard saves this preference to the `projects` table (or project metadata).
2. The AI Gateway (`app/api/ai/chat/route.ts`) reads this on every incoming API request from this project.
3. If an incoming API request does not specify a model, the Gateway will inject the Dashboard-configured Default Model dynamically, bridging the gap between Dashboard configuration and real-time inference execution.

## 4. Architectural Rules for Future Dashboard Dev
- **No Global Stores**: Do not introduce Zustand or Redux unless explicitly necessary for complex client-side interactions (like a graphical flow builder).
- **Query Key Conventions**: Always scope queries by domain and `projectId` (e.g., `['securitySettings', projectId]`).
- **Action Buffering**: For forms with multiple toggles or inputs, prefer the local edit buffer pattern (`SecuritySettings.tsx`) over immediate API calls on every keystroke/toggle to reduce backend load and prevent race conditions.
