import { Key, Copy, AlertTriangle } from "lucide-react";

export default function Step4Page() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">
                    Generate API Key
                </h1>
                <p className="text-muted-foreground">
                    Now let&apos;s create a Cencori API key that your application will use to make requests.
                </p>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">API Key Types</h2>
                <p className="text-sm text-muted-foreground mb-3">
                    Cencori uses prefixed API keys to help you identify their type:
                </p>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left py-2 pr-4 font-medium">Prefix</th>
                                <th className="text-left py-2 pr-4 font-medium">Type</th>
                                <th className="text-left py-2 font-medium">Use Case</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b border-border/50">
                                <td className="py-2 pr-4 font-mono text-primary">csk_</td>
                                <td className="py-2 pr-4">Secret</td>
                                <td className="py-2">Server-side only, full access</td>
                            </tr>
                            <tr className="border-b border-border/50">
                                <td className="py-2 pr-4 font-mono text-primary">cpk_</td>
                                <td className="py-2 pr-4">Publishable</td>
                                <td className="py-2">Browser-safe, domain-restricted</td>
                            </tr>
                            <tr>
                                <td className="py-2 pr-4 font-mono text-primary">csk_test_</td>
                                <td className="py-2 pr-4">Test</td>
                                <td className="py-2">Development environment</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Create a Secret Key</h2>
                <p className="text-sm text-muted-foreground">
                    For this tutorial, we&apos;ll create a secret key for server-side use:
                </p>
                <ol className="space-y-4 text-sm">
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
                        <div>
                            <p className="font-medium">Go to API Keys</p>
                            <p className="text-muted-foreground">
                                In your project sidebar, click <strong>API Keys</strong>
                            </p>
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
                        <div>
                            <p className="font-medium">Click &quot;Generate New Key&quot;</p>
                            <p className="text-muted-foreground">
                                Choose &quot;Secret&quot; as the key type
                            </p>
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
                        <div>
                            <p className="font-medium">Copy the key immediately</p>
                            <p className="text-muted-foreground">
                                It will only be shown once!
                            </p>
                        </div>
                    </li>
                </ol>
            </div>

            <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <p className="text-sm flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                    <span>
                        <strong>Copy your key now!</strong> For security, we only show the full key once. If you lose it, you&apos;ll need to generate a new one.
                    </span>
                </p>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Store Your Key Safely</h2>
                <p className="text-sm text-muted-foreground">
                    Save your key in a <code className="px-1.5 py-0.5 rounded bg-muted text-xs">.env.local</code> file:
                </p>
                <div className="p-4 bg-muted/30 rounded-lg border border-border/50 font-mono text-sm">
                    CENCORI_API_KEY=csk_your_key_here
                </div>
                <p className="text-xs text-muted-foreground">
                    Make sure <code>.env.local</code> is in your <code>.gitignore</code>!
                </p>
            </div>
        </div>
    );
}
