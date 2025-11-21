import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, Zap, Code, Lock } from "lucide-react";

export default function AIDocsPage() {
    return (
        <div className="container max-w-4xl py-10 space-y-8">
            <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight">AI Gateway Documentation</h1>
                <p className="text-xl text-muted-foreground">
                    Build safe, scalable AI features with the Cencori AI Gateway.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Lock className="h-5 w-5 text-primary" />
                            Authentication
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Authenticate requests using your project&apos;s API Key in the header.
                        </p>
                        <div className="bg-muted p-4 rounded-md font-mono text-sm">
                            x-api-key: your_api_key_here
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-primary" />
                            Rate Limits
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4 text-sm text-muted-foreground">
                            To ensure fair usage, requests are capped per project.
                        </p>
                        <div className="flex items-center justify-between p-2 border rounded-md">
                            <span className="font-medium">Limit</span>
                            <Badge variant="secondary">60 requests / min</Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="chat" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="chat">Chat Completion</TabsTrigger>
                    <TabsTrigger value="safety">Safety & Errors</TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>POST /api/ai/chat</CardTitle>
                            <CardDescription>Send a message to the AI model.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm">Request Body</h3>
                                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                                    {`{
  "messages": [
    { "role": "user", "content": "Hello!" }
  ],
  "model": "gemini-1.5-pro", // Optional
  "temperature": 0.7 // Optional
}`}
                                </pre>
                            </div>

                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm">Response</h3>
                                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                                    {`{
  "role": "model",
  "content": "Hello! How can I help you today?",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}`}
                                </pre>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="safety" className="space-y-4 mt-4">
                    <Alert>
                        <Shield className="h-4 w-4" />
                        <AlertTitle>Safety First</AlertTitle>
                        <AlertDescription>
                            All requests pass through our safety layer. Harmful content and PII are automatically blocked.
                        </AlertDescription>
                    </Alert>

                    <Card>
                        <CardHeader>
                            <CardTitle>Error Responses</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm">400 Bad Request (Safety Violation)</h3>
                                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                                    {`{
  "error": "Content safety violation",
  "reasons": [
    "Potential email address detected",
    "Potential prompt injection keyword detected"
  ]
}`}
                                </pre>
                            </div>

                            <div className="space-y-2">
                                <h3 className="font-semibold text-sm">429 Too Many Requests</h3>
                                <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                                    {`{
  "error": "Rate limit exceeded. Please try again later."
}`}
                                </pre>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
