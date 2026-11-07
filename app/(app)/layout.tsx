import { cookies, headers } from "next/headers";
import { requestCountry } from "@/lib/geo/ip-country";
import DashboardLayoutClient from "./DashboardLayoutClient";
import { COPILOT_CONVERSATION_COOKIE, COPILOT_OPEN_COOKIE } from "@/lib/console/copilot";

// Reads the Copilot cookies on the server so a refresh comes back with the
// panel already open and its conversation selected. Cookies are local to the
// request, so this adds no network wait.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const initialAgentOpen = jar.get(COPILOT_OPEN_COOKIE)?.value === "1";
  const initialConversationId = jar.get(COPILOT_CONVERSATION_COOKIE)?.value || null;
  // Picks the dashboard's default money display: naira in Nigeria, dollars
  // elsewhere (until the user chooses). Headers are local, no network wait.
  const country = requestCountry(await headers());

  return (
    <DashboardLayoutClient initialAgentOpen={initialAgentOpen} initialConversationId={initialConversationId} country={country}>
      {children}
    </DashboardLayoutClient>
  );
}
