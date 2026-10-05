export type TensorWaitlistFields = {
  name: string;
  workEmail: string;
  company: string;
  role: string;
  building: string;
  planInterested: string;
  timeline: string;
  currentTools: string[];
  priorities: string[];
  budget: string;
  heardAbout: string;
  anythingElse: string;
};

export type TensorWaitlistFieldKey = keyof TensorWaitlistFields;

export const TENSOR_WAITLIST_FIELD_ORDER: TensorWaitlistFieldKey[] = [
  "name",
  "workEmail",
  "company",
  "role",
  "building",
  "planInterested",
  "timeline",
  "currentTools",
  "priorities",
  "budget",
  "heardAbout",
  "anythingElse",
];

export const TENSOR_WAITLIST_LABELS: Record<TensorWaitlistFieldKey, string> = {
  name: "Name",
  workEmail: "Work email",
  company: "Company / Project name",
  role: "Role",
  building: "What are you building with Tensor?",
  planInterested: "Which Tensor plan are you interested in?",
  timeline: "When do you plan to start using Tensor?",
  currentTools: "What are you using today?",
  priorities: "What matters most to you in a coding agent?",
  budget: "Estimated monthly budget for coding tools",
  heardAbout: "Where did you hear about Tensor?",
  anythingElse: "Anything else you want us to know?",
};

export const TENSOR_WAITLIST_OPTIONS: Partial<Record<TensorWaitlistFieldKey, string[]>> = {
  planInterested: ["Starter — $2 top-up", "Builder — $5", "Pro — $15", "Not sure yet"],
  timeline: ["Immediately", "Within 30 days", "1 to 3 months", "3 to 6 months", "Just exploring"],
  currentTools: [
    "Cursor",
    "Claude Code",
    "GitHub Copilot",
    "Windsurf",
    "OpenAI Codex",
    "Replit",
    "Other",
    "None",
  ],
  priorities: [
    "Code quality",
    "Speed",
    "Context awareness",
    "Repository understanding",
    "Autonomy",
    "Debugging",
    "Refactoring",
    "Security",
    "Price",
    "Other",
  ],
  budget: ["Under $25", "$25 to $50", "$50 to $100", "$100 to $250", "$250+"],
  heardAbout: [
    "X / Twitter",
    "LinkedIn",
    "Cencori",
    "Friend / colleague",
    "Community",
    "Event",
    "Search",
    "Other",
  ],
};

export const TENSOR_WAITLIST_MULTI: Partial<Record<TensorWaitlistFieldKey, boolean>> = {
  currentTools: true,
  priorities: true,
};

export const TENSOR_WAITLIST_OPTIONAL: TensorWaitlistFieldKey[] = ["anythingElse"];

export function emptyTensorWaitlist(): TensorWaitlistFields {
  return {
    name: "",
    workEmail: "",
    company: "",
    role: "",
    building: "",
    planInterested: "",
    timeline: "",
    currentTools: [],
    priorities: [],
    budget: "",
    heardAbout: "",
    anythingElse: "",
  };
}

export function isTensorFieldComplete(key: TensorWaitlistFieldKey, value: TensorWaitlistFields[TensorWaitlistFieldKey]): boolean {
  if (TENSOR_WAITLIST_OPTIONAL.includes(key)) return true;
  if (Array.isArray(value)) return value.length > 0;
  return value.trim().length > 0;
}

export function nextMissingField(collected: TensorWaitlistFields): TensorWaitlistFieldKey | null {
  for (const key of TENSOR_WAITLIST_FIELD_ORDER) {
    if (TENSOR_WAITLIST_OPTIONAL.includes(key)) continue;
    const value = collected[key];
    if (Array.isArray(value)) {
      if (value.length === 0) return key;
    } else if (value.trim() === "") {
      return key;
    }
  }
  // anythingElse is optional — completion means everything else is filled.
  // We still ask it once, tracked client-side via stage; returning null signals ready to submit.
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateTensorField(
  key: TensorWaitlistFieldKey,
  raw: string,
  collected: TensorWaitlistFields,
): { ok: boolean; normalized: string | string[]; error?: string } {
  const value = raw.trim();
  if (TENSOR_WAITLIST_OPTIONAL.includes(key) && value === "") {
    return { ok: true, normalized: "" };
  }
  if (!value) {
    return { ok: false, normalized: Array.isArray(collected[key]) ? [] : "", error: "empty" };
  }
  if (key === "workEmail") {
    if (!EMAIL_RE.test(value)) return { ok: false, normalized: "", error: "invalid-email" };
    return { ok: true, normalized: value };
  }
  const options = TENSOR_WAITLIST_OPTIONS[key];
  if (options && options.length > 0) {
    const isMulti = !!TENSOR_WAITLIST_MULTI[key];
    if (isMulti) {
      // Split on commas, match case-insensitively against options, keep custom bits.
      const parts = value
        .split(/[,;]+|\s*\n\s*/)
        .map((p) => p.trim())
        .filter(Boolean);
      const picked: string[] = [];
      for (const part of parts) {
        const match = options.find((o) => o.toLowerCase() === part.toLowerCase());
        if (match && !picked.includes(match)) picked.push(match);
        else if (!match && part.length > 0 && !picked.includes(part)) picked.push(part);
      }
      // Single chip click arrives as one exact option — accept directly.
      if (picked.length === 0) return { ok: false, normalized: [], error: "empty" };
      // "None" is exclusive.
      if (picked.includes("None") && picked.length > 1) {
        return { ok: true, normalized: ["None"] };
      }
      return { ok: true, normalized: picked };
    }
    const match = options.find((o) => o.toLowerCase() === value.toLowerCase());
    if (match) return { ok: true, normalized: match };
    // Allow "Other: ..." free text for option fields — store as-is.
    return { ok: true, normalized: value };
  }
  return { ok: true, normalized: value };
}

export function scriptedPromptFor(key: TensorWaitlistFieldKey): string {
  switch (key) {
    case "name":
      return "Hey, I'm Tensor. I'll get you on the waitlist in about a minute — what's your name?";
    case "workEmail":
      return "Nice to meet you. What's your work email?";
    case "company":
      return "Got it. What's your company or project name?";
    case "role":
      return "And your role there?";
    case "building":
      return "What are you building with Tensor? A sentence or two is perfect.";
    case "planInterested":
      return "Which Tensor plan are you leaning toward?";
    case "timeline":
      return "When do you plan to start using Tensor?";
    case "currentTools":
      return "What are you using today? Pick all that apply, or type your own.";
    case "priorities":
      return "What matters most to you in a coding agent? Pick all that matter.";
    case "budget":
      return "Roughly what's your monthly budget for coding tools?";
    case "heardAbout":
      return "Where did you hear about Tensor?";
    case "anythingElse":
      return "Last one — anything else you want us to know? (You can skip this.)";
    default:
      return "Tell me more.";
  }
}
