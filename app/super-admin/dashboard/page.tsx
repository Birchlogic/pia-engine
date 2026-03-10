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

    const adminEmail = typeof window !== "undefined" ? localStorage.getItem("superAdminEmail") : "";

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

        </div>
    );
}
