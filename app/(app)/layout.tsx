import { cookies } from "next/headers";
import DashboardLayoutClient from "./DashboardLayoutClient";
import { COPILOT_CONVERSATION_COOKIE, COPILOT_OPEN_COOKIE } from "@/lib/console/copilot";

// Reads the Copilot cookies on the server so a refresh comes back with the
// panel already open and its conversation selected. Cookies are local to the
// request, so this adds no network wait.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const initialAgentOpen = jar.get(COPILOT_OPEN_COOKIE)?.value === "1";
  const initialConversationId = jar.get(COPILOT_CONVERSATION_COOKIE)?.value || null;

  return (
    <DashboardLayoutClient initialAgentOpen={initialAgentOpen} initialConversationId={initialConversationId}>
      {children}
    </DashboardLayoutClient>
  );
}
