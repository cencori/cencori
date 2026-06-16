"use client";

import { AskAISidebar } from "./AskAISidebar";
import { useDocsContext } from "./DocsContext";

/**
 * Bridges the docs Ask-AI sidebar to DocsContext so it can be mounted from the
 * (server) docs layout. Keeps Cencori's existing Gemini-backed Ask AI.
 */
export function DocsAskAI() {
  const { isAskAIOpen, setAskAIOpen } = useDocsContext();
  return (
    <AskAISidebar open={isAskAIOpen} onClose={() => setAskAIOpen(false)} />
  );
}
