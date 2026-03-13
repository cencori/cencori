'use client';

import { AnomalyAlertsPanel } from './AnomalyAlertsPanel';
import { ModelEfficiencyPanel } from './ModelEfficiencyPanel';

interface IntelligencePanelProps {
    projectId: string;
    environment: 'production' | 'test';
}

export function IntelligencePanel({ projectId, environment }: IntelligencePanelProps) {
    return (
        <div>
            <div className="mb-4">
                <h2 className="text-sm font-medium">Intelligence</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Anomaly detection and model efficiency analysis for your workload.
                </p>
            </div>

            <div className="space-y-4">
                <AnomalyAlertsPanel projectId={projectId} environment={environment} />
                <ModelEfficiencyPanel projectId={projectId} environment={environment} />
            </div>
        </div>
    );
}
