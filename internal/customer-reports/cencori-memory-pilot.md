# Cencori Memory Founding Pilot

**Prepared:** September 24, 2026  
**Pilot term:** Three months  
**Status:** Private beta proposal

## Summary

Cencori is offering a three-month founding pilot for persistent agent memory. The pilot lets an agent remember useful facts across conversations, retrieve relevant context when it is needed, understand time-sensitive changes, and connect related people, organizations, projects, and decisions.

## Pilot pricing

| Item | Included |
| --- | --- |
| Subscription | $20 per month |
| Prepaid pilot term | $60 total for three months |
| Memory-enabled turns | 5,000 per month |
| Active memories | Up to 25,000 |
| Projects | One |
| Memory capabilities | Semantic, temporal, and graph memory |
| Additional Memory usage | $5 per additional 1,000 turns |
| Agent model inference | Metered separately through normal Cencori usage |

There is no unlimited-usage commitment. Cencori will provide usage visibility and will not silently convert the pilot into a higher-priced plan.


## How Memory works

For each enabled conversation turn, Cencori can:

1. Retrieve relevant memories before the agent responds.
2. Add the relevant context to the agent's working context.
3. Inspect the completed exchange for durable facts worth remembering.
4. Reconcile new facts with existing facts to avoid duplicates and preserve corrections.
5. Update semantic, temporal, and graph representations asynchronously.

Memory processing is designed to fail open: a Memory provider interruption should not prevent the main agent from responding.

## Data controls

- Memories are scoped to the relevant Cencori organization, project, and end-user or session identifier.
- Memories can be listed, exported, and deleted through the Memory API.
- Current and historical facts are distinguished so a corrected fact does not silently erase its history.

## Beta terms

This is a paid private beta and design-partner engagement, not a custom-built private deployment.

- Best-effort support is included.
- No production uptime SLA is included during the pilot.
- Cencori may improve model routing and implementation details without changing the agreed usage allowance.
- The customer will be informed before any pricing or allowance changes.
- Product feedback will be reviewed throughout the pilot, with a recommended check-in every two weeks.

## Success criteria

During the three-month pilot, Cencori and the customer will evaluate:

- Relevance of recalled memories.
- Reduction in repeated questions and lost context.
- Accuracy of corrected and time-sensitive facts.
- Response quality compared with the existing agent.
- Memory and model cost per successful conversation.
- Operational reliability and integration effort.

At the end of the pilot, both parties can decide whether to continue or move to a generally available Memory plan. There is no automatic long-term commitment.

---

**Cencori**  
Build Different.
