import { CourseStep } from "@/components/academy";

export const GETTING_STARTED_STEPS: CourseStep[] = [
    {
        id: "create-account",
        title: "Create Your Account",
        description: "Sign up for Cencori and explore the dashboard",
        href: "/academy/getting-started/step-1",
        duration: "2 min",
    },
    {
        id: "create-project",
        title: "Create a Project",
        description: "Set up your first project to organize API keys and settings",
        href: "/academy/getting-started/step-2",
        duration: "2 min",
    },
    {
        id: "add-provider-keys",
        title: "Add Provider Keys",
        description: "Connect your OpenAI, Anthropic, or Gemini API keys",
        href: "/academy/getting-started/step-3",
        duration: "2 min",
    },
    {
        id: "generate-api-key",
        title: "Generate API Key",
        description: "Create a Cencori API key for your application",
        href: "/academy/getting-started/step-4",
        duration: "1 min",
    },
    {
        id: "install-sdk",
        title: "Install the SDK",
        description: "Add Cencori to your project with npm or pip",
        href: "/academy/getting-started/step-5",
        duration: "2 min",
    },
    {
        id: "first-request",
        title: "Make Your First Request",
        description: "Send your first AI chat request through Cencori",
        href: "/academy/getting-started/step-6",
        duration: "3 min",
    },
    {
        id: "streaming",
        title: "Enable Streaming",
        description: "Get real-time token-by-token responses",
        href: "/academy/getting-started/step-7",
        duration: "2 min",
    },
    {
        id: "view-logs",
        title: "View Your Logs",
        description: "See every request logged in your dashboard",
        href: "/academy/getting-started/step-8",
        duration: "1 min",
    },
    {
        id: "security-features",
        title: "Explore Security",
        description: "See how Cencori protects your AI requests",
        href: "/academy/getting-started/step-9",
        duration: "2 min",
    },
];

export const COURSE_ID = "getting-started";
export const COURSE_TITLE = "Getting Started with Cencori";
