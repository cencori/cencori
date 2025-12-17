import React from "react";

const steps = [
    {
        number: "01",
        title: "Install the SDK",
        description: "Add Cencori to your project with npm or yarn.",
        code: "npm install cencori",
    },
    {
        number: "02",
        title: "Get your API key",
        description: "Create a free account and grab your API key from the dashboard.",
        code: null,
    },
    {
        number: "03",
        title: "Start building",
        description: "Use any AI provider through a single, unified API.",
        code: `import { Cencori } from 'cencori'

const client = new Cencori({ apiKey: 'your-key' })
const response = await client.chat.completions({
  provider: 'openai',
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
})`,
    },
];

export const HowToSetup = () => {
    return (
        <section className="py-16 bg-background">
            <div className="container mx-auto px-4 md:px-6">
                <div className="text-center mb-10">
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tighter mb-3 text-foreground">
                        Get started in minutes
                    </h2>
                    <p className="text-base text-muted-foreground max-w-lg mx-auto">
                        Three simple steps to production-ready AI infrastructure.
                    </p>
                </div>

                <div className="max-w-2xl mx-auto space-y-8">
                    {steps.map((step, index) => (
                        <div
                            key={step.number}
                            className="flex gap-6 md:gap-8"
                        >
                            {/* Step number */}
                            <div className="flex-shrink-0">
                                <div className="w-12 h-12 rounded-full border border-border bg-card flex items-center justify-center">
                                    <span className="text-sm font-bold text-muted-foreground">
                                        {step.number}
                                    </span>
                                </div>
                                {/* Connector line */}
                                {index < steps.length - 1 && (
                                    <div className="w-px h-full bg-border ml-6 mt-2" />
                                )}
                            </div>

                            {/* Step content */}
                            <div className="flex-1 min-w-0 pb-8">
                                <h3 className="text-xl font-semibold text-foreground mb-2">
                                    {step.title}
                                </h3>
                                <p className="text-muted-foreground mb-4">
                                    {step.description}
                                </p>

                                {step.code && (
                                    <div className="rounded-lg border border-border bg-muted/50 p-4 overflow-x-auto">
                                        <pre className="text-xs md:text-sm font-mono text-foreground/80 whitespace-pre-wrap break-all md:whitespace-pre md:break-normal">
                                            <code>{step.code}</code>
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
