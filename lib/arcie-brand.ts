/** Public positioning. A product definition is not an availability claim. */
export const arcieBrand = {
  name: "Arcie",
  definition: "Arcie—Cencori’s model-agnostic agent infrastructure",
  description:
    "An open-source framework and a managed API for building agents that reason, use tools, remember and act.",
  framework: {
    label: "Open-source framework",
    status: "Available",
    description:
      "Define agents as files. Write tools, add knowledge and coordinate subagents. Run in your own environment and connect to supported model providers.",
  },
  managedApi: {
    label: "Managed API",
    status: "In development",
    description:
      "We’re building a managed entry point to Arcie. Bring your instructions, tools and tasks; Cencori will operate the agent engine and connected execution infrastructure.",
  },
} as const;
