export const CONTACT_INDUSTRIES = [
  "Financial Services",
  "Telecommunications",
  "Healthcare & Life Sciences",
  "Manufacturing & Industrial",
  "Energy & Resources",
  "Government & Public Systems",
  "Technology",
  "Other",
] as const;

export type ContactIndustry = (typeof CONTACT_INDUSTRIES)[number];

export const CONTACT_BUDGETS = [
  "Under $50k",
  "$50k – $250k",
  "$250k – $1M",
  "$1M+",
  "Not sure yet",
] as const;

export type ContactBudget = (typeof CONTACT_BUDGETS)[number];
