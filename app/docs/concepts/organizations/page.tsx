import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/CodeBlock";

export default function OrganizationsPage() {
    return (
        <div className="max-w-4xl space-y-12 px-4 py-12 lg:py-0">
            {/* Header */}
            <div className="space-y-3">
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">
                    Organizations
                </h1>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Learn how organizations work in Cencori, including user management, roles, and billing.
                </p>
            </div>

            {/* What is an Organization */}
            <div className="space-y-4">
                <h2 id="what-is-organization" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    What is an Organization?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    An organization is the top-level container in Cencori. It contains:
                </p>
                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Multiple projects (your AI applications)</li>
                    <li className="list-disc">Team members with different roles</li>
                    <li className="list-disc">Billing and credit balance</li>
                    <li className="list-disc">Custom provider configurations</li>
                    <li className="list-disc">Shared security policies</li>
                </ul>
            </div>

            {/* Organization Structure */}
            <div className="space-y-4">
                <h2 id="structure" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Organization Structure
                </h2>

                <div className="my-6 p-4 border border-border/40 bg-muted/5">
                    <div className="space-y-3 text-sm font-mono">
                        <div>Organization (Acme Corp)</div>
                        <div className="ml-4">├── Projects</div>
                        <div className="ml-8">├── Production API</div>
                        <div className="ml-8">├── Staging API</div>
                        <div className="ml-8">└── Development</div>
                        <div className="ml-4">├── Team Members</div>
                        <div className="ml-8">├── Owner (Full access)</div>
                        <div className="ml-8">├── Admins (Manage projects, view billing)</div>
                        <div className="ml-8">└── Members (Access projects)</div>
                        <div className="ml-4">├── Custom Providers</div>
                        <div className="ml-4">└── Billing</div>
                    </div>
                </div>
            </div>

            {/* Creating an Organization */}
            <div className="space-y-4">
                <h2 id="creating-organization" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Creating an Organization
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    When you first sign up to Cencori, a personal organization is automatically created for you. You can create additional organizations for different teams or companies.
                </p>

                <div className="space-y-3 mt-4">
                    <h3 className="text-base font-semibold">Steps to Create:</h3>
                    <ol className="space-y-2 text-sm ml-6 list-decimal">
                        <li>Click your profile in the top-right corner</li>
                        <li>Select &quot;Create Organization&quot;</li>
                        <li>Enter organization name and description</li>
                        <li>Click &quot;Create&quot;</li>
                    </ol>
                </div>
            </div>

            {/* User Roles */}
            <div className="space-y-4">
                <h2 id="roles" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    User Roles
                </h2>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-3 font-semibold">Role</th>
                                <th className="text-left p-3 font-semibold">Permissions</th>
                            </tr>
                        </thead>
                        <tbody className="text-muted-foreground">
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Owner</td>
                                <td className="p-3">
                                    <ul className="space-y-1">
                                        <li>• Full organization control</li>
                                        <li>• Manage billing and credits</li>
                                        <li>• Delete organization</li>
                                        <li>• Manage all projects</li>
                                        <li>• Invite/remove team members</li>
                                    </ul>
                                </td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Admin</td>
                                <td className="p-3">
                                    <ul className="space-y-1">
                                        <li>• Create and manage projects</li>
                                        <li>• View billing information</li>
                                        <li>• Invite members</li>
                                        <li>• Manage custom providers</li>
                                        <li>• Cannot delete organization</li>
                                    </ul>
                                </td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold">Member</td>
                                <td className="p-3">
                                    <ul className="space-y-1">
                                        <li>• Access assigned projects</li>
                                        <li>• View request logs</li>
                                        <li>• Generate API keys</li>
                                        <li>• Cannot view billing</li>
                                        <li>• Cannot manage team</li>
                                    </ul>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Inviting Team Members */}
            <div className="space-y-4">
                <h2 id="inviting-members" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Inviting Team Members
                </h2>

                <ol className="space-y-2 text-sm ml-6 list-decimal">
                    <li>Go to your organization settings</li>
                    <li>Click &quot;Team&quot; in the sidebar</li>
                    <li>Click &quot;Invite Member&quot;</li>
                    <li>Enter their email address</li>
                    <li>Select their role (Admin or Member)</li>
                    <li>Click &quot;Send Invitation&quot;</li>
                </ol>

                <p className="text-sm text-muted-foreground mt-4">
                    The invited user will receive an email with an invitation link. They must accept the invitation to join your organization.
                </p>
            </div>

            {/* Switching Organizations */}
            <div className="space-y-4">
                <h2 id="switching" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Switching Between Organizations
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    If you&apos;re a member of multiple organizations:
                </p>

                <ol className="space-y-2 text-sm ml-6 list-decimal mt-3">
                    <li>Click the organization name in the top-left corner</li>
                    <li>Select from the dropdown list</li>
                    <li>The dashboard will refresh with the new organization&apos;s data</li>
                </ol>
            </div>

            {/* Billing per Organization */}
            <div className="space-y-4">
                <h2 id="billing" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Billing and Credits
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Each organization has its own:
                </p>

                <ul className="space-y-2 text-sm ml-6 mt-3">
                    <li className="list-disc">Credit balance</li>
                    <li className="list-disc">Billing history</li>
                    <li className="list-disc">Payment methods</li>
                    <li className="list-disc">Usage reports</li>
                </ul>

                <p className="text-sm text-muted-foreground leading-relaxed mt-4">
                    Credits are not shared between organizations. If you create multiple organizations, you&apos;ll need to add credits to each one separately.
                </p>
            </div>

            {/* Organization Settings */}
            <div className="space-y-4">
                <h2 id="settings" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Organization Settings
                </h2>

                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold mb-2">General</h3>
                        <ul className="space-y-1 text-sm ml-6">
                            <li className="list-disc">Organization name</li>
                            <li className="list-disc">Description</li>
                            <li className="list-disc">Organization slug (URL identifier)</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Team</h3>
                        <ul className="space-y-1 text-sm ml-6">
                            <li className="list-disc">View all members</li>
                            <li className="list-disc">Pending invitations</li>
                            <li className="list-disc">Manage roles</li>
                            <li className="list-disc">Remove members</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Billing</h3>
                        <ul className="space-y-1 text-sm ml-6">
                            <li className="list-disc">Current balance</li>
                            <li className="list-disc">Add credits</li>
                            <li className="list-disc">Transaction history</li>
                            <li className="list-disc">Payment methods</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-base font-semibold mb-2">Danger Zone</h3>
                        <ul className="space-y-1 text-sm ml-6">
                            <li className="list-disc">Delete organization (owner only)</li>
                            <li className="list-disc">Transfer ownership</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Best Practices */}
            <div className="space-y-4">
                <h2 id="best-practices" className="scroll-m-20 text-xl font-semibold tracking-tight">
                    Best Practices
                </h2>

                <ul className="space-y-2 text-sm ml-6">
                    <li className="list-disc">Create separate organizations for completely different businesses or clients</li>
                    <li className="list-disc">Use projects within an organization  to separate environments (dev, staging, prod)</li>
                    <li className="list-disc">Assign the minimum required role to team members (principle of least privilege)</li>
                    <li className="list-disc">Regularly review team members and remove those who no longer need access</li>
                    <li className="list-disc">Set up billing alerts to avoid unexpected charges</li>
                </ul>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-8 mt-12 border-t border-border/40">
                <Link href="/docs/concepts/projects">
                    <Button variant="ghost" className="gap-2">
                        <ChevronLeft className="h-4 w-4" />
                        <span className="flex flex-col items-start">
                            <span className="text-xs text-muted-foreground">Previous</span>
                            <span className="text-sm font-medium">Projects</span>
                        </span>
                    </Button>
                </Link>
                <Link href="/docs/guides/custom-providers">
                    <Button variant="ghost" className="gap-2">
                        <span className="flex flex-col items-end">
                            <span className="text-xs text-muted-foreground">Next</span>
                            <span className="text-sm font-medium">Custom Providers</span>
                        </span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
