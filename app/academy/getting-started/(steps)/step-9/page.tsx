import { CodeBlock } from "@/components/docs/CodeBlock";
import { Shield, AlertTriangle, Eye, Lock } from "lucide-react";

export default function Step9Page() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">
                    Explore Security Features
                </h1>
                <p className="text-muted-foreground">
                    Cencori automatically protects your AI requests. Let&apos;s see how it works.
                </p>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Built-in Protection</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Every request passes through multiple security layers:
                </p>
                <div className="space-y-3">
                    <div className="flex gap-3 items-start p-3 rounded-lg border border-border/50">
                        <Eye className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-sm">PII Detection</p>
                            <p className="text-xs text-muted-foreground">
                                Automatically detects emails, phone numbers, SSNs, credit cards, and more
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3 items-start p-3 rounded-lg border border-border/50">
                        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-sm">Jailbreak Protection</p>
                            <p className="text-xs text-muted-foreground">
                                Detects prompt injection attempts and manipulation tactics
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3 items-start p-3 rounded-lg border border-border/50">
                        <Shield className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-sm">Content Filtering</p>
                            <p className="text-xs text-muted-foreground">
                                Blocks harmful content, hate speech, and policy violations
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3 items-start p-3 rounded-lg border border-border/50">
                        <Lock className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-sm">Output Scanning</p>
                            <p className="text-xs text-muted-foreground">
                                Checks AI responses before they reach your users
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Try It: PII Detection</h2>
                <p className="text-sm text-muted-foreground">
                    Send a message containing PII and see it get blocked:
                </p>
                <CodeBlock
                    language="typescript"
                    filename="test-pii.ts"
                    code={`const response = await cencori.ai.chat({
  model: 'gpt-4o',
  messages: [{
    role: 'user',
    content: 'My email is john@example.com and my SSN is 123-45-6789'
  }]
});

// This will throw a SafetyError!
// Error: Content blocked for safety reasons
// Reasons: ['PII detected: email', 'PII detected: SSN']`}
                />
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Handling Security Errors</h2>
                <CodeBlock
                    language="typescript"
                    filename="handle-security.ts"
                    code={`import { Cencori, SafetyError } from 'cencori';

try {
  const response = await cencori.ai.chat({...});
} catch (error) {
  if (error instanceof SafetyError) {
    console.log('Blocked by security:', error.reasons);
    // ['PII detected: email', 'Jailbreak attempt detected']
  }
}`}
                />
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Security Dashboard</h2>
                <p className="text-sm text-muted-foreground">
                    In your project, check the <strong>Security</strong> section to:
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• View security incidents</li>
                    <li>• Adjust detection thresholds</li>
                    <li>• Create custom data rules</li>
                    <li>• Export audit logs</li>
                </ul>
            </div>

            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-sm">
                    <strong>🎉 Congratulations!</strong> You now have enterprise-grade AI security without writing any security code.
                </p>
            </div>
        </div>
    );
}
