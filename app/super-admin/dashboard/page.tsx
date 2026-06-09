"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Activity, Users, Settings, RefreshCw } from "lucide-react";

// ─── Types ───

interface Organization {
    id: string;
    name: string;
    industry: string | null;
    jurisdiction: string | null;
    createdAt: string;
    projectLimit: number;
    _count: { projects: number; users: number };
}

interface OrgUser {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    orgId: string | null;
    organization?: {
        name: string;
    } | null;
}

interface LlmProviderConfig {
    id: string;
    type: string;
    model: string;
    apiKey: string;
    status: string;
    createdAt: string;
    admin: { email: string };
}

interface ActivityLog {
    id: string;
    userId: string;
    orgId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    details: any;
    createdAt: string;
    user: { name: string; email: string };
    organization: { name: string } | null;
}

// ─── API Helper ───

function useApi() {
    const router = useRouter();

    const apiFetch = useCallback(
        async (url: string, options: RequestInit = {}) => {
            const token = localStorage.getItem("superAdminToken");
            if (!token) {
                router.push("/super-admin");
                throw new Error("Not authenticated");
            }

            const res = await fetch(url, {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    ...options.headers,
                },
            });

            const data = await res.json();

            if (res.status === 401) {
                localStorage.removeItem("superAdminToken");
                localStorage.removeItem("superAdminEmail");
                router.push("/super-admin");
                throw new Error("Session expired");
            }

            return data;
        },
        [router]
    );

    return apiFetch;
}

// ─── Main Dashboard ───

export default function SuperAdminDashboard() {
    const router = useRouter();
    const apiFetch = useApi();

    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
    const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);

    // Platform Users State
    const [allUsers, setAllUsers] = useState<OrgUser[]>([]);
    const [allUsersLoading, setAllUsersLoading] = useState(false);

    // Modals
    const [showCreateOrg, setShowCreateOrg] = useState(false);
    const [showAddUser, setShowAddUser] = useState(false);
    const [showAssignUser, setShowAssignUser] = useState(false);

    // Confirmation Modals State
    const [orgToDelete, setOrgToDelete] = useState<string | null>(null);
    const [userToDeactivate, setUserToDeactivate] = useState<string | null>(null);

    // Form state
    const [orgForm, setOrgForm] = useState({
        orgName: "",
        industry: "",
        jurisdiction: "",
        projectLimit: 3,
        adminName: "",
        adminEmail: "",
        adminPassword: "",
    });
    const [userForm, setUserForm] = useState({
        name: "",
        email: "",
        password: "",
        role: "analyst",
    });

    const [selectedUserToAssign, setSelectedUserToAssign] = useState<string | null>(null);
    const [assignRole, setAssignRole] = useState("analyst");
    const [formLoading, setFormLoading] = useState(false);

    // LLM Provider State
    const [llmProviders, setLlmProviders] = useState<LlmProviderConfig[]>([]);
    const [llmLoading, setLlmLoading] = useState(false);
    const [showAddProvider, setShowAddProvider] = useState(false);
    const [providerForm, setProviderForm] = useState({ type: "OPENROUTER", model: "", apiKey: "" });

    // Activity Logs State
    const [activitySummary, setActivitySummary] = useState<any[]>([]);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [selectedLogOrg, setSelectedLogOrg] = useState<any | null>(null);
    const [selectedLogUser, setSelectedLogUser] = useState<any | null>(null);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);

    const adminEmail = typeof window !== "undefined" ? localStorage.getItem("superAdminEmail") : "";

    // ─── Load logs summary ───
    const loadLogSummary = useCallback(async () => {
        try {
            setSummaryLoading(true);
            const data = await apiFetch("/api/super-admin/activity-logs?action=summary");
            if (data.success) setActivitySummary(data.data);
        } catch {} finally {
            setSummaryLoading(false);
        }
    }, [apiFetch]);

    // ─── Load specific logs ───
    const loadLogs = useCallback(async (userId?: string, orgId?: string) => {
        try {
            setLogsLoading(true);
            let url = "/api/super-admin/activity-logs";
            // if we have specific filters, append them
            if (userId) {
                url += `?userId=${userId}&orgId=${orgId === "SYSTEM" ? "" : (orgId || "")}`;
            }
            const data = await apiFetch(url);
            if (data.success) setActivityLogs(data.data);
        } catch {
            // Handled
        } finally {
            setLogsLoading(false);
        }
    }, [apiFetch]);

    // ─── Load orgs ───
    const loadOrgs = useCallback(async () => {
        try {
            setLoading(true);
            const data = await apiFetch("/api/super-admin/orgs");
            if (data.success) setOrgs(data.data);
        } catch {
            // handled in apiFetch
        } finally {
            setLoading(false);
        }
    }, [apiFetch]);

    useEffect(() => {
        const token = localStorage.getItem("superAdminToken");
        if (!token) {
            router.push("/super-admin");
            return;
        }
        loadOrgs();
        loadLlmProviders();
    }, [router, loadOrgs]);

    // ─── Load users for selected org ───
    const loadOrgUsers = useCallback(
        async (orgId: string) => {
            try {
                setUsersLoading(true);
                const data = await apiFetch(`/api/super-admin/orgs/${orgId}/users`);
                if (data.success) setOrgUsers(data.data);
            } catch {
                // handled
            } finally {
                setUsersLoading(false);
            }
        },
        [apiFetch]
    );

    useEffect(() => {
        if (selectedOrg) loadOrgUsers(selectedOrg);
    }, [selectedOrg, loadOrgUsers]);

    // ─── Load All Users (for assignment) ───
    const loadAllUsers = useCallback(async () => {
        try {
            setAllUsersLoading(true);
            const data = await apiFetch("/api/super-admin/users");
            if (data.success) setAllUsers(data.data);
        } catch {
            // handled
        } finally {
            setAllUsersLoading(false);
        }
    }, [apiFetch]);

    // ─── Create Org ───
    async function handleCreateOrg(e: React.FormEvent) {
        e.preventDefault();
        setFormLoading(true);

        try {
            const data = await apiFetch("/api/super-admin/orgs", {
                method: "POST",
                body: JSON.stringify({
                    orgName: orgForm.orgName,
                    industry: orgForm.industry || undefined,
                    jurisdiction: orgForm.jurisdiction || undefined,
                    projectLimit: orgForm.projectLimit,
                    adminUser: {
                        name: orgForm.adminName,
                        email: orgForm.adminEmail,
                        password: orgForm.adminPassword,
                    },
                }),
            });

            if (!data.success) {
                toast.error(data.message || "Failed to create organization");
                return;
            }

            toast.success("Organization created successfully");
            setShowCreateOrg(false);
            setOrgForm({ orgName: "", industry: "", jurisdiction: "", projectLimit: 3, adminName: "", adminEmail: "", adminPassword: "" });
            loadOrgs();
        } catch {
            toast.error("Failed to create organization. Network error.");
        } finally {
            setFormLoading(false);
        }
    }

    // ─── Add User ───
    async function handleAddUser(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedOrg) return;
        setFormLoading(true);

        try {
            const data = await apiFetch(`/api/super-admin/orgs/${selectedOrg}/users`, {
                method: "POST",
                body: JSON.stringify(userForm),
            });

            if (!data.success) {
                toast.error(data.message || "Failed to add user");
                return;
            }

            toast.success("User added successfully");
            setShowAddUser(false);
            setUserForm({ name: "", email: "", password: "", role: "analyst" });
            loadOrgUsers(selectedOrg);
        } catch {
            toast.error("Failed to add user. Network error.");
        } finally {
            setFormLoading(false);
        }
    }

    // ─── Assign Existing User ───
    async function handleAssignUser(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedOrg || !selectedUserToAssign) return;
        setFormLoading(true);

        try {
            const data = await apiFetch(`/api/super-admin/orgs/${selectedOrg}/assign-user`, {
                method: "POST",
                body: JSON.stringify({
                    userId: selectedUserToAssign,
                    role: assignRole,
                }),
            });

            if (!data.success) {
                toast.error(data.message || "Failed to assign user");
                return;
            }

            toast.success("User assigned successfully");
            setShowAssignUser(false);
            setSelectedUserToAssign(null);
            setAssignRole("analyst");
            loadOrgUsers(selectedOrg);
        } catch {
            toast.error("Failed to assign user. Network error.");
        } finally {
            setFormLoading(false);
        }
    }

    // ─── Deactivate User ───
    async function confirmDeactivateUser() {
        if (!userToDeactivate) return;
        setFormLoading(true);

        try {
            const data = await apiFetch(`/api/super-admin/users/${userToDeactivate}`, {
                method: "DELETE",
            });

            if (data.success && selectedOrg) {
                toast.success("User deactivated successfully");
                loadOrgUsers(selectedOrg);
            } else {
                toast.error(data.message || "Failed to deactivate user");
            }
        } catch {
            toast.error("An error occurred deactivating the user");
        } finally {
            setFormLoading(false);
            setUserToDeactivate(null);
        }
    }

    // ─── Delete Org ───
    async function confirmDeleteOrg() {
        if (!orgToDelete) return;
        setFormLoading(true);

        try {
            const data = await apiFetch(`/api/super-admin/orgs/${orgToDelete}`, {
                method: "DELETE",
            });

            if (data.success) {
                toast.success("Organization deleted successfully");
                if (selectedOrg === orgToDelete) {
                    setSelectedOrg(null);
                    setOrgUsers([]);
                }
                loadOrgs();
            } else {
                toast.error(data.message || "Failed to delete organization");
            }
        } catch (error) {
            toast.error("An error occurred deleting the organization");
        } finally {
            setFormLoading(false);
            setOrgToDelete(null);
        }
    }

    // ─── Logout ───
    function handleLogout() {
        localStorage.removeItem("superAdminToken");
        localStorage.removeItem("superAdminEmail");
        router.push("/super-admin");
    }

    // ─── LLM Provider CRUD ───
    const loadLlmProviders = useCallback(async () => {
        try {
            setLlmLoading(true);
            const data = await apiFetch("/api/super-admin/llm-providers");
            if (data.success) setLlmProviders(data.data);
        } catch {
            // handled
        } finally {
            setLlmLoading(false);
        }
    }, [apiFetch]);

    async function handleAddProvider(e: React.FormEvent) {
        e.preventDefault();
        setFormLoading(true);
        try {
            const data = await apiFetch("/api/super-admin/llm-providers", {
                method: "POST",
                body: JSON.stringify(providerForm),
            });
            if (!data.success) {
                toast.error(data.message || "Failed to add provider");
                return;
            }
            toast.success("Provider added successfully");
            setShowAddProvider(false);
            setProviderForm({ type: "OPENROUTER", model: "", apiKey: "" });
            loadLlmProviders();
        } catch {
            toast.error("Failed to add provider");
        } finally {
            setFormLoading(false);
        }
    }

    async function handleActivateProvider(providerId: string) {
        try {
            const data = await apiFetch(`/api/super-admin/llm-providers/${providerId}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "ACTIVE" }),
            });
            if (data.success) {
                toast.success("Provider activated");
                loadLlmProviders();
            } else {
                toast.error(data.message || "Failed to activate");
            }
        } catch {
            toast.error("Error activating provider");
        }
    }

    async function handleDeleteProvider(providerId: string) {
        try {
            const data = await apiFetch(`/api/super-admin/llm-providers/${providerId}`, {
                method: "DELETE",
            });
            if (data.success) {
                toast.success("Provider deleted");
                loadLlmProviders();
            } else {
                toast.error(data.message || "Failed to delete");
            }
        } catch {
            toast.error("Error deleting provider");
        }
    }

    const activeProvider = llmProviders.find((p) => p.status === "ACTIVE");

    // Filter platform users: show users that are active and not in the currently selected org
    const availableUsersToAssign = allUsers.filter(u => u.isActive && u.orgId !== selectedOrg);

    // ─── Render ───
    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Top bar */}
            <header className="border-b bg-card sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 flex items-center justify-center text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">Super Admin Console</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground hidden sm:inline-block">{adminEmail}</span>
                        <Button variant="outline" size="sm" onClick={handleLogout}>
                            Sign Out
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                <Tabs defaultValue="tenants" className="space-y-6">
                    <TabsList className="bg-muted/50 p-1 border">
                        <TabsTrigger value="tenants" className="gap-2">
                            <Users className="w-4 h-4" /> Tenant Management
                        </TabsTrigger>
                        <TabsTrigger value="activity" className="gap-2" onClick={loadLogSummary}>
                            <Activity className="w-4 h-4" /> Activity Logs
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="tenants" className="space-y-8 mt-0 border-none p-0 outline-none">
                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Organizations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{orgs.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{orgs.reduce((sum, o) => sum + o._count.users, 0)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{orgs.reduce((sum, o) => sum + o._count.projects, 0)}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* LLM Providers Section */}
                <Card className="mb-8">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <div>
                            <CardTitle className="text-base">LLM Providers</CardTitle>
                            <CardDescription className="text-xs">Manage AI model configurations. Only one provider can be active at a time.</CardDescription>
                        </div>
                        <Button size="sm" onClick={() => setShowAddProvider(true)}>
                            Add Provider
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0 border-t">
                        {/* Active Provider Banner */}
                        {activeProvider && (
                            <div className="mx-4 mt-4 mb-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <div>
                                        <p className="text-sm font-medium">Active: <span className="text-green-600 dark:text-green-400">{activeProvider.type}</span></p>
                                        <p className="text-xs text-muted-foreground">Model: {activeProvider.model}</p>
                                    </div>
                                </div>
                                <span className="inline-flex items-center rounded-sm px-2 py-0.5 text-[10px] font-semibold bg-green-500/20 text-green-700 dark:text-green-400 uppercase">Active</span>
                            </div>
                        )}
                        {!activeProvider && !llmLoading && (
                            <div className="mx-4 mt-4 mb-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                <p className="text-sm text-amber-600 dark:text-amber-400">⚠ No active LLM provider. Add and activate one to enable AI features.</p>
                            </div>
                        )}

                        {llmLoading ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">Loading providers...</div>
                        ) : llmProviders.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                No providers configured yet. Click "Add Provider" to get started.
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Provider</TableHead>
                                        <TableHead>Model</TableHead>
                                        <TableHead>API Key</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Added By</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {llmProviders.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell>
                                                <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold uppercase ${
                                                    p.type === "CLAUDE" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                                    : p.type === "OPENAI" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                    : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                                                }`}>
                                                    {p.type}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{p.model}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{p.apiKey}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${p.status === "ACTIVE" ? "bg-green-500" : "bg-gray-400"}`} />
                                                    <span className="text-xs">{p.status}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{p.admin?.email || "—"}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {p.status !== "ACTIVE" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                                            onClick={() => handleActivateProvider(p.id)}
                                                        >
                                                            Activate
                                                        </Button>
                                                    )}
                                                    {p.status !== "ACTIVE" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleDeleteProvider(p.id)}
                                                        >
                                                            Delete
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                {/* Main layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Org list */}
                    <Card className="lg:col-span-1 flex flex-col h-[calc(100vh-250px)]">
                        <CardHeader className="flex flex-row items-center justify-between pb-4">
                            <div>
                                <CardTitle className="text-base">Organizations</CardTitle>
                                <CardDescription className="text-xs">Manage tenant instances</CardDescription>
                            </div>
                            <Button size="sm" onClick={() => setShowCreateOrg(true)}>
                                Create Org
                            </Button>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto p-0 border-t">
                            {loading ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
                            ) : orgs.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                    No organizations yet
                                </div>
                            ) : (
                                <div className="divide-y">
                                    {orgs.map((org) => (
                                        <button
                                            key={org.id}
                                            onClick={() => setSelectedOrg(org.id)}
                                            className={`w-full text-left p-4 hover:bg-muted/50 transition-colors flex flex-col gap-1 ${selectedOrg === org.id ? "bg-muted" : ""
                                                }`}
                                        >
                                            <div className="font-medium text-sm">{org.name}</div>
                                            <div className="text-xs text-muted-foreground flex gap-3">
                                                <span>{org._count.users} users</span>
                                                <span>{org._count.projects} / {org.projectLimit} projects</span>
                                            </div>
                                            {org.industry && (
                                                <span className="inline-block px-2 py-0.5 rounded-sm bg-primary/10 text-primary text-[10px] w-fit mt-1">
                                                    {org.industry}
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Org detail / users */}
                    <Card className="lg:col-span-2 flex flex-col h-[calc(100vh-250px)]">
                        {selectedOrg ? (
                            <>
                                <CardHeader className="flex flex-row items-center justify-between pb-4">
                                    <div>
                                        <CardTitle className="text-base">
                                            {orgs.find((o) => o.id === selectedOrg)?.name} Users
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Manage users for this organization
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                                loadAllUsers();
                                                setShowAssignUser(true);
                                            }}
                                        >
                                            Assign User
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => setShowAddUser(true)}
                                        >
                                            Add User
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => setOrgToDelete(selectedOrg)}
                                        >
                                            Delete Org
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-y-auto p-0 border-t">
                                    {usersLoading ? (
                                        <div className="p-8 text-center text-muted-foreground text-sm">Loading users...</div>
                                    ) : orgUsers.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground text-sm">
                                            No users in this organization
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[200px]">Name</TableHead>
                                                    <TableHead>Email</TableHead>
                                                    <TableHead>Role</TableHead>
                                                    <TableHead>Status</TableHead>
                                                    <TableHead className="text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {orgUsers.map((u) => (
                                                    <TableRow key={u.id}>
                                                        <TableCell className="font-medium">{u.name}</TableCell>
                                                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                                                        <TableCell>
                                                            <span className="inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground uppercase">
                                                                {u.role.replace("_", " ")}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-green-500" : "bg-red-500"}`} />
                                                                <span className="text-xs">{u.isActive ? "Active" : "Deactivated"}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {u.isActive && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-destructive h-8 px-2 hover:text-destructive hover:bg-destructive/10"
                                                                    onClick={() => setUserToDeactivate(u.id)}
                                                                >
                                                                    Deactivate
                                                                </Button>
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </CardContent>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                                    <svg className="w-6 h-6 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect width="16" height="16" x="4" y="4" rx="2" />
                                        <rect width="6" height="6" x="9" y="9" rx="1" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-medium text-foreground">No Organization Selected</h3>
                                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                                    Select an organization from the sidebar to view and manage its users, or create a new organization to get started.
                                </p>
                            </div>
                        )}
                    </Card>
                </div>
                </TabsContent>

                <TabsContent value="activity" className="mt-0 border-none p-0 outline-none">
                    <Card className="flex flex-col h-[calc(100vh-180px)] overflow-hidden">
                        <CardHeader className="pb-4 border-b flex-none">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            System Activity Logs
                                            {!selectedLogOrg && (
                                                <Button size="icon" variant="ghost" className="h-6 w-6 ml-1 text-muted-foreground hover:text-foreground" onClick={loadLogSummary} title="Refresh Summary">
                                                    <RefreshCw className={`w-3.5 h-3.5 ${summaryLoading ? "animate-spin" : ""}`} />
                                                </Button>
                                            )}
                                        </CardTitle>
                                        <CardDescription className="text-xs mt-1">
                                            {selectedLogOrg ? `Viewing activity for ${selectedLogOrg.orgName}` : "Monitor user actions hierarchically across all organizations."}
                                        </CardDescription>
                                    </div>
                                </div>
                                {selectedLogOrg && (
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="outline" onClick={() => loadLogSummary()} title="Refresh Organization Data">
                                            <RefreshCw className={`w-4 h-4 mr-2 ${summaryLoading ? "animate-spin" : ""}`} />
                                            Refresh
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={() => {
                                            setSelectedLogUser(null);
                                            setSelectedLogOrg(null);
                                        }}>
                                            ← Back to Organizations
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        
                        <CardContent className="flex-1 p-0 bg-muted/5 sm:bg-background overflow-hidden flex flex-col">
                            {!selectedLogOrg ? (
                                // Tier 1: Organizations
                                <div className="flex-1 overflow-y-auto p-6">
                                    {summaryLoading ? (
                                        <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                            <span>Loading activity summary...</span>
                                        </div>
                                    ) : activitySummary.length === 0 ? (
                                        <div className="p-8 text-center text-muted-foreground text-sm border border-dashed rounded-lg">No recorded organizational activity yet.</div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {activitySummary.map((org) => (
                                                <Card key={org.orgId} className="cursor-pointer hover:bg-muted/50 transition-all shadow-sm border-muted-foreground/20 hover:border-primary/50" onClick={() => setSelectedLogOrg(org)}>
                                                    <CardContent className="p-5 flex flex-col gap-2">
                                                        <div className="font-semibold text-sm truncate">{org.orgName}</div>
                                                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                                                            <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {org.users.length} Users</span>
                                                            <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> {org.users.reduce((sum: number, u: any) => sum + u.logCount, 0)} Logs</span>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                // Tier 2 & 3: Split Pane
                                <div className="flex flex-1 overflow-hidden">
                                     {/* Left Pane: Users List */}
                                     <div className="w-1/4 min-w-[260px] max-w-[320px] border-r overflow-y-auto bg-muted/10 flex flex-col">
                                         <div className="p-3 border-b bg-muted/30 sticky top-0 z-10 flex items-center justify-between">
                                             <div className="text-xs font-semibold flex items-center gap-2 text-foreground/80">
                                                 <Users className="w-3.5 h-3.5" />
                                                 Organization Users
                                             </div>
                                             <Badge variant="secondary" className="text-[10px]">{selectedLogOrg.users.length}</Badge>
                                         </div>
                                         <div className="p-2 space-y-1">
                                             {selectedLogOrg.users.map((u: any) => (
                                                 <button
                                                     key={u.userId}
                                                     onClick={() => {
                                                         setSelectedLogUser(u);
                                                         loadLogs(u.userId, selectedLogOrg.orgId);
                                                     }}
                                                     className={`w-full text-left p-3 rounded-md transition-all ${selectedLogUser?.userId === u.userId ? "bg-primary/10 border border-primary/20 shadow-sm" : "hover:bg-muted/50 border border-transparent"}`}
                                                 >
                                                     <div className="font-medium text-sm truncate">{u.userName}</div>
                                                     <div className="text-[10px] text-muted-foreground truncate mb-1.5">{u.email}</div>
                                                     <div className="text-[10px] text-primary flex items-center gap-1 font-medium"><Activity className="w-3 h-3"/> {u.logCount} Logs</div>
                                                 </button>
                                             ))}
                                         </div>
                                     </div>

                                     {/* Right Pane: Logs Table */}
                                     <div className="flex-1 flex flex-col overflow-hidden bg-background relative">
                                         {!selectedLogUser ? (
                                             <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                                                 <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4 border border-dashed border-muted-foreground/30">
                                                    <Users className="w-5 h-5 text-muted-foreground" />
                                                 </div>
                                                 <h3 className="text-base font-medium text-foreground">Select a user</h3>
                                                 <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                                                     Choose a user from the left panel to view their detailed activity history.
                                                 </p>
                                             </div>
                                         ) : (
                                             <div className="flex flex-col h-full overflow-hidden">
                                                 <div className="bg-muted/5 px-4 py-3 border-b flex items-center justify-between sticky top-0 z-10">
                                                     <div className="flex items-center gap-3">
                                                         <div>
                                                             <div className="font-medium text-sm">Activity logs for {selectedLogUser.userName}</div>
                                                             <div className="text-xs text-muted-foreground">{selectedLogUser.email}</div>
                                                         </div>
                                                     </div>
                                                     <div className="flex items-center gap-2">
                                                         <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-tight hidden sm:flex">{selectedLogOrg.orgName}</Badge>
                                                         <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => loadLogs(selectedLogUser.userId, selectedLogOrg.orgId)} title="Refresh User Logs">
                                                             <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? "animate-spin" : ""}`} />
                                                         </Button>
                                                     </div>
                                                 </div>
                                                 <div className="flex-1 overflow-y-auto relative p-0">
                                                     {logsLoading ? (
                                                         <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                                                            <RefreshCw className="w-6 h-6 animate-spin text-primary mb-2" />
                                                            <span className="text-xs text-muted-foreground font-medium">Loading logs...</span>
                                                         </div>
                                                     ) : null}
                                                     
                                                     {activityLogs.length === 0 && !logsLoading ? (
                                                         <div className="p-8 text-center text-muted-foreground text-sm mt-10 border border-dashed rounded-lg mx-4">No specific logs found.</div>
                                                     ) : (
                                                         <Table>
                                                             <TableHeader className="sticky top-0 bg-background z-10 shadow-sm border-b">
                                                                 <TableRow className="hover:bg-transparent">
                                                                     <TableHead className="w-[160px] text-xs">Timestamp</TableHead>
                                                                     <TableHead className="w-[120px] text-xs">Action</TableHead>
                                                                     <TableHead className="w-[160px] text-xs">Entity</TableHead>
                                                                     <TableHead className="text-xs">Details</TableHead>
                                                                 </TableRow>
                                                             </TableHeader>
                                                             <TableBody>
                                                                 {activityLogs.map((log) => (
                                                                     <TableRow key={log.id} className="hover:bg-muted/30 border-b">
                                                                         <TableCell className="text-[11px] text-muted-foreground whitespace-nowrap align-top">
                                                                             {new Date(log.createdAt).toLocaleString()}
                                                                         </TableCell>
                                                                         <TableCell className="align-top">
                                                                             <Badge variant="outline" className="text-[9px] uppercase font-mono tracking-tight bg-slate-50 dark:bg-slate-900 border-primary/20 text-primary">
                                                                                 {log.action.replace(/_/g, " ")}
                                                                             </Badge>
                                                                         </TableCell>
                                                                         <TableCell className="align-top">
                                                                             <div className="text-xs font-semibold truncate max-w-[150px]">{log.entityType}</div>
                                                                             <div className="text-[9px] font-mono text-muted-foreground truncate max-w-[150px]" title={log.entityId}>
                                                                                 {log.entityId.split("-")[0]}...
                                                                             </div>
                                                                         </TableCell>
                                                                         <TableCell className="align-top">
                                                                             {log.details && Object.keys(log.details).length > 0 ? (
                                                                                 <div className="text-[11px] text-muted-foreground space-y-0.5 max-w-full overflow-hidden">
                                                                                     {Object.entries(log.details).map(([k, v]) => (
                                                                                         <div key={k} className="flex gap-2 w-full break-all">
                                                                                             <span className="font-medium text-foreground opacity-60 w-16 flex-shrink-0 truncate">{k}:</span>
                                                                                             <span className="font-mono text-[10px] break-all">{String(v)}</span>
                                                                                         </div>
                                                                                     ))}
                                                                                 </div>
                                                                             ) : (
                                                                                 <span className="text-muted-foreground opacity-50">—</span>
                                                                             )}
                                                                         </TableCell>
                                                                     </TableRow>
                                                                 ))}
                                                             </TableBody>
                                                         </Table>
                                                     )}
                                                 </div>
                                             </div>
                                         )}
                                     </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                </Tabs>
            </main>

            {/* ─── Create Org Modal ─── */}
            <Dialog open={showCreateOrg} onOpenChange={setShowCreateOrg}>
                <DialogContent className="sm:max-w-[500px]">
                    <form onSubmit={handleCreateOrg}>
                        <DialogHeader>
                            <DialogTitle>Create Organization</DialogTitle>
                            <DialogDescription>
                                Create a new tenant instance. An admin user will be created automatically.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2">
                                    <Label htmlFor="orgName">Organization Name *</Label>
                                    <Input id="orgName" value={orgForm.orgName} onChange={(e) => setOrgForm({ ...orgForm, orgName: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="industry">Industry</Label>
                                    <Input id="industry" value={orgForm.industry} onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="jurisdiction">Jurisdiction</Label>
                                    <Input id="jurisdiction" value={orgForm.jurisdiction} onChange={(e) => setOrgForm({ ...orgForm, jurisdiction: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="projectLimit">Project Limit</Label>
                                    <Input id="projectLimit" type="number" min="1" value={orgForm.projectLimit} onChange={(e) => setOrgForm({ ...orgForm, projectLimit: parseInt(e.target.value) || 3 })} />
                                </div>
                            </div>

                            <div className="border-t pt-4 mt-2">
                                <h4 className="text-sm font-medium mb-4">Admin User Details</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2 col-span-2">
                                        <Label htmlFor="adminName">Admin Name *</Label>
                                        <Input id="adminName" value={orgForm.adminName} onChange={(e) => setOrgForm({ ...orgForm, adminName: e.target.value })} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="adminEmail">Admin Email *</Label>
                                        <Input id="adminEmail" type="email" value={orgForm.adminEmail} onChange={(e) => setOrgForm({ ...orgForm, adminEmail: e.target.value })} required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="adminPassword">Admin Password *</Label>
                                        <Input id="adminPassword" type="password" value={orgForm.adminPassword} onChange={(e) => setOrgForm({ ...orgForm, adminPassword: e.target.value })} required />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowCreateOrg(false)} disabled={formLoading}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={formLoading}>
                                {formLoading ? "Creating..." : "Create Organization"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Add User Modal ─── */}
            <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
                <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleAddUser}>
                        <DialogHeader>
                            <DialogTitle>Add New User</DialogTitle>
                            <DialogDescription>
                                Create a new user for this organization.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name *</Label>
                                <Input id="name" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address *</Label>
                                <Input id="email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Temporary Password *</Label>
                                <Input id="password" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="role">Platform Role *</Label>
                                <select
                                    id="role"
                                    value={userForm.role}
                                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="admin">Admin</option>
                                    <option value="senior_assessor">Senior Assessor</option>
                                    <option value="analyst">Analyst</option>
                                </select>
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowAddUser(false)} disabled={formLoading}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={formLoading}>
                                {formLoading ? "Adding..." : "Add User"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Assign Existing User Modal ─── */}
            <Dialog open={showAssignUser} onOpenChange={(open) => {
                setShowAssignUser(open);
                if (!open) setSelectedUserToAssign(null);
            }}>
                <DialogContent className="sm:max-w-[550px]">
                    <form onSubmit={handleAssignUser}>
                        <DialogHeader>
                            <DialogTitle>Assign Existing User</DialogTitle>
                            <DialogDescription>
                                Select a platform user to assign to this organization.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="py-4 space-y-4">
                            {allUsersLoading ? (
                                <div className="text-center text-sm text-muted-foreground py-8">Loading users...</div>
                            ) : availableUsersToAssign.length === 0 ? (
                                <div className="text-center text-sm text-muted-foreground py-8 border rounded-md">
                                    No available users to assign.
                                </div>
                            ) : (
                                <div className="border rounded-md max-h-[300px] overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>User</TableHead>
                                                <TableHead>Current Org</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {availableUsersToAssign.map((u) => (
                                                <TableRow
                                                    key={u.id}
                                                    onClick={() => setSelectedUserToAssign(u.id)}
                                                    className={`cursor-pointer ${selectedUserToAssign === u.id ? "bg-muted" : ""}`}
                                                >
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedUserToAssign === u.id ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>
                                                                {selectedUserToAssign === u.id && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-sm">{u.name}</div>
                                                                <div className="text-xs text-muted-foreground">{u.email}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-xs">
                                                        {u.organization?.name || "Unassigned"}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {selectedUserToAssign && (
                                <div className="space-y-2 pt-2 border-t">
                                    <Label htmlFor="assignRole">Assign Role in this Org *</Label>
                                    <select
                                        id="assignRole"
                                        value={assignRole}
                                        onChange={(e) => setAssignRole(e.target.value)}
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="senior_assessor">Senior Assessor</option>
                                        <option value="analyst">Analyst</option>
                                    </select>
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowAssignUser(false)} disabled={formLoading}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={!selectedUserToAssign || formLoading}>
                                {formLoading ? "Assigning..." : "Confirm Assignment"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Confirm Delete Org Modal ─── */}
            <Dialog open={orgToDelete !== null} onOpenChange={(open) => { if (!open) setOrgToDelete(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Organization</DialogTitle>
                        <DialogDescription className="text-destructive font-medium mt-2">
                            Are you absolutely sure?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 text-sm text-muted-foreground">
                        This action cannot be undone. This will permanently delete the organization
                        and cascade-delete all associated projects, verticals, sessions, and files.
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOrgToDelete(null)} disabled={formLoading}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDeleteOrg} disabled={formLoading}>
                            {formLoading ? "Deleting..." : "Delete Organization"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Confirm Deactivate User Modal ─── */}
            <Dialog open={userToDeactivate !== null} onOpenChange={(open) => { if (!open) setUserToDeactivate(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Deactivate User</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to deactivate this user?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 text-sm text-muted-foreground">
                        The user will immediately lose access to the platform.
                        Their data and audit trails will be preserved.
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUserToDeactivate(null)} disabled={formLoading}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDeactivateUser} disabled={formLoading}>
                            {formLoading ? "Deactivating..." : "Deactivate User"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Add LLM Provider Modal ─── */}
            <Dialog open={showAddProvider} onOpenChange={setShowAddProvider}>
                <DialogContent className="sm:max-w-[450px]">
                    <form onSubmit={handleAddProvider}>
                        <DialogHeader>
                            <DialogTitle>Add LLM Provider</DialogTitle>
                            <DialogDescription>
                                Configure a new AI model provider. You can activate it after adding.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="providerType">Provider Type *</Label>
                                <select
                                    id="providerType"
                                    value={providerForm.type}
                                    onChange={(e) => setProviderForm({ ...providerForm, type: e.target.value })}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                >
                                    <option value="CLAUDE">Claude (Anthropic)</option>
                                    <option value="OPENAI">OpenAI</option>
                                    <option value="OPENROUTER">OpenRouter</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="modelName">Model Name *</Label>
                                <Input
                                    id="modelName"
                                    placeholder={providerForm.type === "OPENROUTER" ? "anthropic/claude-sonnet-4-20250514" : providerForm.type === "OPENAI" ? "gpt-4o" : "claude-sonnet-4-20250514"}
                                    value={providerForm.model}
                                    onChange={(e) => setProviderForm({ ...providerForm, model: e.target.value })}
                                    required
                                />
                                <p className="text-[10px] text-muted-foreground">The exact model identifier from the provider.</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="providerApiKey">API Key *</Label>
                                <Input
                                    id="providerApiKey"
                                    type="password"
                                    placeholder="sk-..."
                                    value={providerForm.apiKey}
                                    onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowAddProvider(false)} disabled={formLoading}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={formLoading}>
                                {formLoading ? "Adding..." : "Add Provider"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

        </div>
    );
}
