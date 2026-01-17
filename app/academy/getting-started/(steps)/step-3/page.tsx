import Link from "next/link";
import { ExternalLink, Key, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Step3Page() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">
                    Add Provider Keys
                </h1>
                <p className="text-muted-foreground">
                    Cencori routes your requests to AI providers using your own API keys. This is called &quot;Bring Your Own Keys&quot; (BYOK).
                </p>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Why BYOK?</h2>
                <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2">
                        <span className="text-primary">✓</span>
                        You control your AI spend directly with providers
                    </li>
                    <li className="flex gap-2">
                        <span className="text-primary">✓</span>
                        Use your existing API keys and quotas
                    </li>
                    <li className="flex gap-2">
                        <span className="text-primary">✓</span>
                        Switch providers without changing your Cencori code
                    </li>
                    <li className="flex gap-2">
                        <span className="text-primary">✓</span>
                        Your keys are encrypted at rest
                    </li>
                </ul>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Add Your First Provider Key</h2>
                <ol className="space-y-4 text-sm">
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
                        <div>
                            <p className="font-medium">Navigate to Providers</p>
                            <p className="text-muted-foreground">
                                In your project sidebar, click <strong>Providers</strong>
                            </p>
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
                        <div>
                            <p className="font-medium">Choose a provider</p>
                            <p className="text-muted-foreground mb-2">
                                Pick one you have an API key for:
                            </p>
                            <div className="grid gap-2 sm:grid-cols-3">
                                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                                    <p className="font-medium text-sm">OpenAI</p>
                                    <p className="text-xs text-muted-foreground">GPT-4, GPT-4o</p>
                                </div>
                                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                                    <p className="font-medium text-sm">Anthropic</p>
                                    <p className="text-xs text-muted-foreground">Claude 3.5, 4</p>
                                </div>
                                <div className="p-3 rounded-lg border border-border/50 bg-muted/20">
                                    <p className="font-medium text-sm">Google</p>
                                    <p className="text-xs text-muted-foreground">Gemini 2.5 Flash</p>
                                </div>
                            </div>
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
                        <div>
                            <p className="font-medium">Paste your API key</p>
                            <p className="text-muted-foreground">
                                Enter your key and save. Cencori encrypts it immediately.
                            </p>
                        </div>
                    </li>
                </ol>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                <h3 className="font-medium flex items-center gap-2 mb-2">
                    <Key className="h-4 w-4" />
                    Where to get API keys
                </h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>
                        <strong>OpenAI:</strong>{" "}
                        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-primary hover:underline">
                            platform.openai.com/api-keys
                        </a>
                    </li>
                    <li>
                        <strong>Anthropic:</strong>{" "}
                        <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="text-primary hover:underline">
                            console.anthropic.com
                        </a>
                    </li>
                    <li>
                        <strong>Google:</strong>{" "}
                        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-primary hover:underline">
                            aistudio.google.com
                        </a>
                    </li>
                </ul>
            </div>

            <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-sm flex items-start gap-2">
                    <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                        <strong>Your keys are secure.</strong> Cencori encrypts all API keys using AES-256 encryption. They&apos;re only decrypted when making requests to providers.
                    </span>
                </p>
            </div>
        </div>
    );
}
