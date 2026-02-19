# Deep Dive: Security Tokenization & Custom Data Rules

This document outlines the end-to-end flow of Cencori's Custom Data Rules, focusing specifically on the **Tokenization** action. 

## 1. Overview and Core Concepts

Custom Data Rules allow Cencori users to define domain-specific sensitive data (e.g., Farm Yields, MRNs, Credit Cards) and actively prevent this data from reaching upstream LLM providers, while maintaining application functionality.

### Rule Properties
Rules are stored in the `custom_data_rules` Supabase table and consist of:
- **Match Type**: `keywords`, `regex`, `json_path`, or `ai_detect` (uses Gemini 2.5 Flash to classify intent).
- **Pattern**: The actual string, regex, or natural language description.
- **Action**: `mask` (`****`), `redact` (`[REDACTED]`), `block` (halts request), or `tokenize`.

## 2. Tokenization: The "Ghost" Flow

Tokenization is the most advanced action. It temporarily replaces PII with semantically meaningful placeholders during the LLM inference phase, and restores the original data before returning the response to the user.

### A. Intake & Rule Evaluation
When a request hits the AI Gateway (`app/api/ai/chat/route.ts`):
1. The gateway fetches active rules for the project via `supabase`.
2. It calls `processCustomRules()` (located in `lib/safety/custom-data-rules.ts`).
3. For `tokenize` rules, it passes a `tokenMap` reference.

### B. The Labelling Mechanism
Inside `applyTokenize()`:
1. When a pattern (e.g., an email) is matched, the engine generates a **Type Label**.
   *Example*: If the rule name is "Email Addresses", the base label becomes `EMAIL`.
2. It assigns a sequential ID: `[EMAIL_1]`, `[EMAIL_2]`.
3. It stores the bidirectional mapping in a Map: `{ "[EMAIL_1]": "sarah@acme.com" }`.
4. The user's input string is mutated to contain the placeholder.

### C. LLM Execution
The LLM provider receives the sanitized prompt: 
> "My email is [EMAIL_1]"

Because the placeholder retains semantic clustering (e.g., `EMAIL` vs a random UUID), the LLM understands how to operate on it naturally without hallucinating constraints.

### D. Streaming De-Tokenization
The magic happens during the response stream. As the LLM streams back chunks containing placeholders (e.g., "Contact [EMAIL_1]"):
1. The gateway intercepts the stream chunks.
2. It calls `deTokenize(chunk, tokenMap)`.
3. The chunk sent to the client is seamlessly restored to "Contact sarah@acme.com".

### E. Persistence Layer Safety
When logging the request to the `ai_requests` table (for dashboard observability), the gateway explicitly saves the **tokenized** version of the prompt and response. The `tokenMap` is dropped from memory immediately after the request concludes. PII never touches disk.

## 3. The `ai_detect` Matcher
For edge cases where regex is insufficient (e.g., "Attorney-client privileged information"), Cencori uses an asynchronous pre-flight check:
1. A 5-second timeout promise races against a `gemini-2.5-flash` API call.
2. The model acts as a binary classifier, returning a structured JSON array of matching snippets.
3. Those snippets are then fed into the standard tokenization/redaction pipeline.

## 4. UI State Management
The frontend `CustomDataRulesManager.tsx` uses `@tanstack/react-query` to manage client-side state, syncing via standard REST endpoints (`/api/projects/[id]/custom-rules`). Pre-built UI templates (Healthcare, Finance, Agriculture) serve as quick-starts, mapping directly to pre-configured regex and `ai_detect` prompts.
