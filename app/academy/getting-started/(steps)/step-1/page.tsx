import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function Step1Page() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight mb-2">
                    Create Your Account
                </h1>
                <p className="text-muted-foreground">
                    Let&apos;s get you set up with a Cencori account. This takes less than a minute.
                </p>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Sign Up for Cencori</h2>
                <p className="text-sm text-muted-foreground">
                    Click the button below to open the signup page in a new tab:
                </p>
                <Link href="/signup" target="_blank">
                    <Button className="gap-2">
                        Create Account
                        <ExternalLink className="h-4 w-4" />
                    </Button>
                </Link>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">What Happens Next</h2>
                <ol className="space-y-3 text-sm">
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
                        <div>
                            <p className="font-medium">Enter your email and password</p>
                            <p className="text-muted-foreground">Or sign in with Google/GitHub</p>
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
                        <div>
                            <p className="font-medium">Verify your email</p>
                            <p className="text-muted-foreground">Check your inbox for a verification link</p>
                        </div>
                    </li>
                    <li className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
                        <div>
                            <p className="font-medium">You&apos;re in!</p>
                            <p className="text-muted-foreground">You&apos;ll land on the dashboard where we&apos;ll create your first project</p>
                        </div>
                    </li>
                </ol>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
                <p className="text-sm">
                    <strong>Already have an account?</strong> Great! Just{" "}
                    <Link href="/login" className="text-primary hover:underline">
                        sign in
                    </Link>
                    {" "}and continue to the next step.
                </p>
            </div>
        </div>
    );
}
