"use client";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeployAgentDialog } from "@/components/agents/DeployAgentDialog";

interface BlueprintCardProps {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    features: string[];
    isPopular?: boolean;
    isNew?: boolean;
    projectId: string;
    orgSlug: string;
    projectSlug: string;
    onSelect?: () => void;
}

export function BlueprintCard({
    id,
    title,
    description,
    icon,
    features,
    isPopular,
    isNew,
    projectId,
    orgSlug,
    projectSlug,
}: BlueprintCardProps) {

    return (
        <Card className={cn("relative flex flex-col transition-all hover:border-primary/50 border-border/60 shadow-sm", isPopular && "border-primary/40 bg-primary/5")}>
            {isPopular && (
                <div className="absolute top-2 right-2">
                    <Badge className="bg-primary/20 text-primary hover:bg-primary/30 text-[10px] h-5 px-1.5 border-0">
                        Popular
                    </Badge>
                </div>
            )}
            {isNew && (
                <div className="absolute top-2 right-2">
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-background">New</Badge>
                </div>
            )}

            <CardHeader className="p-4 pb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
                    {icon}
                </div>
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <CardDescription className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5em]">
                    {description}
                </CardDescription>
            </CardHeader>

            <CardContent className="p-4 pt-2 flex-1">
                <ul className="space-y-1.5">
                    {features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <Check className="w-3 h-3 text-primary/70 shrink-0" />
                            {feature}
                        </li>
                    ))}
                </ul>
            </CardContent>

            <CardFooter className="p-4 pt-0">
                <DeployAgentDialog
                    blueprintId={id}
                    blueprintTitle={title}
                    projectId={projectId}
                    orgSlug={orgSlug}
                    projectSlug={projectSlug}
                >
                    <Button className="w-full h-8 text-xs" size="sm">
                        Deploy Agent
                        <ArrowRight className="w-3 h-3 ml-1.5 opacity-50" />
                    </Button>
                </DeployAgentDialog>
            </CardFooter>
        </Card>
    );
}
