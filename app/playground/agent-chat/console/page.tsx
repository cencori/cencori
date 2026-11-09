import { notFound } from 'next/navigation';
import { ConsoleAgentChat } from './console-chat';

/** Local-only: <AgentChat widgetKey> talking to a console-built agent (Cencori Support). */
export default function ConsoleAgentDemoPage() {
    if (process.env.NODE_ENV === 'production') notFound();
    return <ConsoleAgentChat />;
}
