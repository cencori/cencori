import { defineAgent } from "jett";

export default defineAgent({
  model: "claude-sonnet-4-5",
  name: "my-agent",
  description: "A Jett agent powered by Cencori.",
  cencori: {
    project: process.env.CENCORI_PROJECT_ID,
    billing: {
      budget: "50.00/month",
    },
  },
});
