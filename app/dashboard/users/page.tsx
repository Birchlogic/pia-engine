"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

type User = {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    projectMemberships?: { projectId: string, role: string }[];
    _count: { projectMemberships: number };
};

export default function UsersPage() {
    const { data: session, status } = useSession();
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<{ id: string, name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    
    // Removal State
    const [removingUserId, setRemovingUserId] = useState<string | null>(null);
    const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

    // Assignment State
    const [assignUserId, setAssignUserId] = useState<string | null>(null);
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);
    const [processingProject, setProcessingProject] = useState<string | null>(null);

    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        role: "analyst",
    });

    // Security guard + fetching
    useEffect(() => {
        if (status === "loading") return;

        // Hard redirect if not admin
        if (session?.user?.role !== "admin") {
            redirect("/dashboard/projects");
        }

        fetchUsers();
        fetchProjects();
    }, [session, status]);

    const fetchProjects = async () => {
        try {
            const res = await fetch("/api/projects");
            const data = await res.json();
            if (data.success) {
                setProjects(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch projects", error);
        }
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/users");
            const data = await res.json();
            if (data.success) {
                setUsers(data.data);
            } else {
                toast.error(data.message || "Failed to load users");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error connecting to server");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async () => {
        if (!form.name || !form.email || !form.password) {
            toast.error("Please fill in all required fields.");
            return;
        }
        if (form.password.length < 6) {
            toast.error("Password must be at least 6 characters.");
            return;
        }

        setCreating(true);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });

            const data = await res.json();
            if (data.success) {
                toast.success("User successfully added.");
                setDialogOpen(false);
                setForm({ name: "", email: "", password: "", role: "analyst" });
                fetchUsers();
            } else {
                toast.error(data.message || "Failed to create user.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error creating user.");
        } finally {
            setCreating(false);
        }
    };

    const confirmRemoveUser = (userId: string) => {
        setRemovingUserId(userId);
        setRemoveDialogOpen(true);
    };

    const handleRemoveUser = async () => {
        if (!removingUserId) return;

        try {
            const res = await fetch(`/api/users/${removingUserId}`, {
                method: "DELETE",
            });

            const data = await res.json();
            if (data.success) {
                toast.success("User successfully removed.");
                fetchUsers();
            } else {
                toast.error(data.message || "Failed to remove user.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error communicating with server.");
        } finally {
            setRemoveDialogOpen(false);
            setRemovingUserId(null);
        }
    };

    const openAssignDialog = (userId: string) => {
        setAssignUserId(userId);
        setAssignDialogOpen(true);
    };

    const toggleProjectAssignment = async (projectId: string, isAssigned: boolean) => {
        if (!assignUserId || processingProject) return;
        setProcessingProject(projectId);
        
        try {
            if (isAssigned) {
                // Remove Access
                const res = await fetch(`/api/projects/${projectId}/members?userId=${assignUserId}`, {
                    method: "DELETE"
                });
                if (res.ok) {
                    toast.success("Access revoked");
                }
            } else {
                // Grant Access (Defaulting to Analyst)
                const res = await fetch(`/api/projects/${projectId}/members`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: assignUserId, role: "analyst" })
                });
                if (res.ok) {
                    toast.success("Access granted");
                }
            }
            // Seamlessly refresh users to update their badges
            await fetchUsers();
        } catch (error) {
            console.error(error);
            toast.error("Failed to update access");
        } finally {
            setProcessingProject(null);
        }
    };

    if (loading || status === "loading") {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-4 w-96" />
                <Separator />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Organization Users</h1>
                    <p className="text-muted-foreground mt-1">Manage platform access and roles for your team</p>
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <line x1="19" y1="8" x2="19" y2="14" />
                                <line x1="22" y1="11" x2="16" y2="11" />
                            </svg>
                            Add User
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New User</DialogTitle>
                            <DialogDescription>Create a new account within your organization.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Full Name</Label>
                                <Input
                                    id="name"
                                    placeholder="Jane Doe"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="jane@company.com"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Temporary Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Platform Role</Label>
                                <Select
                                    value={form.role}
                                    onValueChange={(val) => setForm({ ...form, role: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">Administrator (Full Access)</SelectItem>
                                        <SelectItem value="senior_assessor">Senior Assessor</SelectItem>
                                        <SelectItem value="analyst">Analyst</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleCreateUser} disabled={creating}>
                                {creating ? "Adding..." : "Add User"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Separator />

            <Card>
                <CardHeader className="pb-4">
                    <CardTitle>Team Members ({users.length})</CardTitle>
                    <CardDescription>A list of all users tied to this organization.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>System Role</TableHead>
                                <TableHead>Assigned Projects</TableHead>
                                <TableHead>Date Added</TableHead>
                                <TableHead className="w-[80px] text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No users found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((userObj) => (
                                    <TableRow key={userObj.id}>
                                        <TableCell>
                                            <div className="font-medium">{userObj.name}</div>
                                            <div className="text-sm text-muted-foreground">{userObj.email}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={userObj.role === "admin" ? "default" : "secondary"} className="capitalize">
                                                {userObj.role}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-muted-foreground text-sm">
                                                {userObj._count?.projectMemberships || 0} projects
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-muted-foreground text-sm">
                                                {new Date(userObj.createdAt).toLocaleDateString()}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {session?.user?.id !== userObj.id && (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                                                                <circle cx="12" cy="12" r="1" />
                                                                <circle cx="12" cy="5" r="1" />
                                                                <circle cx="12" cy="19" r="1" />
                                                            </svg>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => openAssignDialog(userObj.id)} className="cursor-pointer">
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                                                            Manage Projects
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() => confirmRemoveUser(userObj.id)}
                                                            className="text-destructive focus:text-destructive cursor-pointer focus:bg-destructive/10"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 mr-2">
                                                                <path d="M3 6h18" />
                                                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                                            </svg>
                                                            Remove User
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Remove User</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove this user from the organization? This will instantly revoke their access and they will be removed from all projects.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={() => setRemoveDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleRemoveUser}>
                            Confirm Removal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assign Projects Modal */}
            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Manage Project Access</DialogTitle>
                        <DialogDescription>
                            Toggle which projects this user can access. They will be granted Editor permissions by default.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                        {projects.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center p-4">No projects available in this organization.</p>
                        ) : (
                            projects.map(proj => {
                                const selectedUser = users.find(u => u.id === assignUserId);
                                const isAssigned = selectedUser?.projectMemberships?.some((m: any) => m.projectId === proj.id) || false;
                                
                                return (
                                    <div key={proj.id} className="flex items-center justify-between p-3 border rounded-md shadow-sm">
                                        <div>
                                            <p className="font-medium text-sm">{proj.name}</p>
                                            <p className="text-[10px] text-muted-foreground">ID: {proj.id.split("-")[0]}</p>
                                        </div>
                                        <Checkbox 
                                            checked={isAssigned} 
                                            disabled={processingProject === proj.id}
                                            onCheckedChange={() => toggleProjectAssignment(proj.id, isAssigned)} 
                                        />
                                    </div>
                                );
                            })
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
