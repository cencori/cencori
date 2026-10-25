'use client';

import { CopilotPageFrame } from '@/components/copilot/CopilotPageFrame';
import { CopilotUsage } from '@/components/copilot/CopilotUsage';

export default function CopilotUsagePage() {
    return (
        <CopilotPageFrame title="Usage" description="What Copilot has cost your organization, by conversation.">
            {({ organizationId }) => <CopilotUsage organizationId={organizationId} />}
        </CopilotPageFrame>
    );
}
