import { notFound } from 'next/navigation';
import { DemoChat } from './demo-chat';

export default function AgentChatDemoPage() {
    if (process.env.NODE_ENV === 'production') notFound();
    return <DemoChat />;
}
