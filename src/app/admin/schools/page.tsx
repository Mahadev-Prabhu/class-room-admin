"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TruncatedText } from "@/components/admin/TruncatedText";
import { Copy, Eye, EyeOff, Info, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDisplayName, formatUsDate } from "@/lib/utils";
import {
  activateAdmin,
  createSchoolAdminAccount,
  deactivateAdmin,
  fetchAllAdmins,
  sendSchoolAdminPasswordResetEmail,
} from "@/lib/firebase-service";
import { Admin } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

export default function SchoolsPage() {
  const router = useRouter();
  const { admin, loading: authLoading } = useAuth();
  const [schools, setSchools] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "activate" | "deactivate";
    school: Admin;
  } | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<Admin | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreatingSchool, setIsCreatingSchool] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [showCreatedPassword, setShowCreatedPassword] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (admin?.role !== "super_admin") {
      router.push("/admin/dashboard");
    }
  }, [admin, authLoading, router]);

  const loadSchools = useCallback(async () => {
    if (!admin || admin.role !== "super_admin") return;

    try {
      setLoading(true);
      const admins = await fetchAllAdmins();
      setSchools(admins.filter((item) => item.role === "school_admin"));
    } catch (error) {
      console.error("Failed to load schools:", error);
      toast.error("Failed to load schools");
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    loadSchools();
  }, [loadSchools]);

  const handleActivate = async (schoolUid: string) => {
    setUpdatingUid(schoolUid);

    try {
      await activateAdmin(schoolUid);
      toast.success("School activated successfully");
      await loadSchools();
    } catch {
      toast.error("Failed to activate school");
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleDeactivate = async (schoolUid: string) => {
    setUpdatingUid(schoolUid);

    try {
      await deactivateAdmin(schoolUid);
      toast.success("School deactivated");
      await loadSchools();
    } catch {
      toast.error("Failed to deactivate school");
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    const schoolUid = confirmAction.school.uid;
    const actionType = confirmAction.type;
    setConfirmAction(null);

    if (actionType === "activate") {
      await handleActivate(schoolUid);
      return;
    }

    await handleDeactivate(schoolUid);
  };

  const resetCreateForm = () => {
    setNewAdminName("");
    setNewAdminEmail("");
    setNewAdminPassword("");
  };

  const handleCreateSchoolAdmin = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!admin) return;

    if (newAdminPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsCreatingSchool(true);

    try {
      await createSchoolAdminAccount(
        newAdminEmail.trim(),
        newAdminPassword,
        newAdminName.trim(),
        admin.uid
      );
      toast.success("School admin account created successfully");
      setCreatedCredentials({
        email: newAdminEmail.trim(),
        password: newAdminPassword,
      });
      setIsCreateDialogOpen(false);
      resetCreateForm();
      await loadSchools();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create school admin account"
      );
    } finally {
      setIsCreatingSchool(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!createdCredentials) return;

    await navigator.clipboard.writeText(
      `Email: ${createdCredentials.email}\nInitial Password: ${createdCredentials.password}`
    );
    toast.success("Credentials copied");
  };

  const handleSendResetLink = async (email: string) => {
    try {
      await sendSchoolAdminPasswordResetEmail(email);
      toast.success("Password reset link sent");
    } catch {
      toast.error("Failed to send password reset link");
    }
  };

  const filteredSchools = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return schools;
    }

    return schools.filter((school) => {
      const signInDetails = school.sign_in_details;
      const schoolDetails = school.school_details;
      const values = [
        schoolDetails?.school_name,
        signInDetails?.name || school.name,
        signInDetails?.email || signInDetails?.sign_in_email || school.email,
        schoolDetails?.country,
        schoolDetails?.state,
        schoolDetails?.phone,
      ];

      return values.some((value) => value?.toLowerCase().includes(query));
    });
  }, [schools, searchQuery]);

  if (authLoading || admin?.role !== "super_admin") {
    return null;
  }

  const getSchoolViewData = (school: Admin) => {
    const signInDetails = school.sign_in_details;
    const schoolDetails = school.school_details;
    const setupComplete =
      signInDetails?.is_setup_complete ?? school.is_setup_complete;
    const isActive = signInDetails?.is_active ?? school.is_active;
    return {
      email:
        signInDetails?.email ||
        signInDetails?.sign_in_email ||
        school.email ||
        "-",
      adminName:
        formatDisplayName(signInDetails?.name) ||
        formatDisplayName(school.name) ||
        "-",
      schoolName: formatDisplayName(schoolDetails?.school_name) || "Setup pending",
      phone: schoolDetails?.phone || "-",
      country: schoolDetails?.country || "-",
      state: schoolDetails?.state || "-",
      address1: schoolDetails?.address_1 || "-",
      address2: schoolDetails?.address_2 || "-",
      zipCode: schoolDetails?.zip_code || "-",
      teacherCount: school.teachers ? Object.keys(school.teachers).length : 0,
      isActive,
      setupComplete,
      createdAt: signInDetails?.created_at || school.created_at,
    };
  };

  const getStatusLabel = (isActive: boolean, setupComplete: boolean) => {
    if (!isActive) {
      return "Inactive";
    }

    return setupComplete ? "Active" : "Setup Pending";
  };

  const renderStatusBadge = (isActive: boolean, setupComplete: boolean) => (
    <Badge
      variant={isActive ? "default" : "destructive"}
    >
      {getStatusLabel(isActive, setupComplete)}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schools</h1>
          <p className="text-muted-foreground">
            View and manage school admin accounts in the system
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Create School Account
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>All Schools</CardTitle>
              <CardDescription>
                {filteredSchools.length} school{filteredSchools.length !== 1 ? "s" : ""} found
              </CardDescription>
            </div>
            <div className="w-72">
              <Input
                placeholder="Search by school, admin, email..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredSchools.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No schools match your search." : "No schools found."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Email</TableHead>
                  <TableHead className="text-center">School</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Teachers</TableHead>
                  <TableHead className="w-[80px] text-center">Info</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSchools.map((school) => {
                  const viewData = getSchoolViewData(school);

                  return (
                    <TableRow key={school.uid}>
                      <TableCell className="text-muted-foreground">
                        <TruncatedText value={viewData.email} maxChars={28} />
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        <TruncatedText
                          value={viewData.schoolName}
                          maxChars={24}
                          className="mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        {renderStatusBadge(
                          viewData.isActive,
                          viewData.setupComplete
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{viewData.teacherCount} teachers</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={`View details for ${viewData.schoolName}`}
                          onClick={() => setSelectedSchool(school)}
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        {viewData.isActive ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-destructive text-destructive hover:bg-destructive hover:text-white"
                            disabled={updatingUid === school.uid}
                            onClick={() =>
                              setConfirmAction({ type: "deactivate", school })
                            }
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-green-600 text-green-700 hover:bg-green-600 hover:text-white"
                            disabled={updatingUid === school.uid}
                            onClick={() =>
                              setConfirmAction({ type: "activate", school })
                            }
                          >
                            Activate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Schools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{schools.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Setup Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {
                schools.filter(
                  (school) =>
                    school.sign_in_details?.is_setup_complete ??
                    school.is_setup_complete
                ).length
              }
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Assigned Teachers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {schools.reduce(
                (sum, school) => sum + (school.teachers ? Object.keys(school.teachers).length : 0),
                0
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedSchool} onOpenChange={(open) => !open && setSelectedSchool(null)}>
        <DialogContent className="sm:max-w-[560px]">
          {selectedSchool && (
            <>
              {(() => {
                const viewData = getSchoolViewData(selectedSchool);
                const details = [
                  ["Admin Name", viewData.adminName],
                  ["Email", viewData.email],
                  ["Phone", viewData.phone],
                  ["Country", viewData.country],
                  ["State/Region", viewData.state],
                  ["Address 1", viewData.address1],
                  ["Address 2", viewData.address2],
                  ["Zip Code", viewData.zipCode],
                  [
                    "Created",
                    formatUsDate(viewData.createdAt),
                  ],
                  ["Teachers", `${viewData.teacherCount}`],
                  ["Setup", viewData.setupComplete ? "Complete" : "Pending"],
                  ["Active", viewData.isActive ? "Yes" : "No"],
                ];

                return (
                  <>
                    <DialogHeader>
                      <DialogTitle>{viewData.schoolName}</DialogTitle>
                      <DialogDescription>
                        School admin account details
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-5">
                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-sm text-muted-foreground">Status</span>
                        {renderStatusBadge(
                          viewData.isActive,
                          viewData.setupComplete
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {details.map(([label, value]) => (
                          <div key={label} className="space-y-1">
                            <div className="text-xs font-medium uppercase text-muted-foreground">
                              {label}
                            </div>
                            <div className="break-words text-sm">{value}</div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendResetLink(viewData.email)}
                        >
                          Send reset password link
                        </Button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            resetCreateForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Create School Admin Account</DialogTitle>
            <DialogDescription>
              Create login credentials to share with the school admin. School
              details will be collected when they sign in for the first time.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSchoolAdmin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="schoolAdminName" className="text-sm font-medium">
                Admin Name
              </label>
              <Input
                id="schoolAdminName"
                value={newAdminName}
                onChange={(event) => setNewAdminName(event.target.value)}
                placeholder="School admin name"
                required
                disabled={isCreatingSchool}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="schoolAdminEmail" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="schoolAdminEmail"
                type="email"
                value={newAdminEmail}
                onChange={(event) => setNewAdminEmail(event.target.value)}
                placeholder="school@example.com"
                required
                disabled={isCreatingSchool}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="schoolAdminPassword" className="text-sm font-medium">
                Initial Password
              </label>
              <Input
                id="schoolAdminPassword"
                type="password"
                value={newAdminPassword}
                onChange={(event) => setNewAdminPassword(event.target.value)}
                placeholder="Minimum 6 characters"
                required
                disabled={isCreatingSchool}
              />
              <p className="text-xs text-muted-foreground">
                Share this password with the school admin. They can reset it from
                the sign-in page.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isCreatingSchool}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingSchool}>
                {isCreatingSchool ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!createdCredentials}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedCredentials(null);
            setShowCreatedPassword(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>School Account Created</DialogTitle>
            <DialogDescription>
              Share these credentials with the school admin. The initial password
              will only be shown once.
            </DialogDescription>
          </DialogHeader>
          {createdCredentials && (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Email
                </div>
                <div className="break-words text-sm font-medium">
                  {createdCredentials.email}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  Initial Password
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    type={showCreatedPassword ? "text" : "password"}
                    value={createdCredentials.password}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={
                      showCreatedPassword ? "Hide password" : "Show password"
                    }
                    onClick={() => setShowCreatedPassword((current) => !current)}
                  >
                    {showCreatedPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCopyCredentials}>
                  <Copy className="h-4 w-4" />
                  Copy Credentials
                </Button>
                <Button
                  onClick={() => {
                    setCreatedCredentials(null);
                    setShowCreatedPassword(false);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "deactivate"
                ? "Deactivate school?"
                : "Activate school?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "activate"
                ? "This school admin will be able to access dashboard features again."
                : "This school admin will lose access to dashboard features until activated again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={
                confirmAction?.type === "activate"
                  ? ""
                  : "bg-destructive text-white hover:bg-destructive/90"
              }
            >
              {confirmAction?.type === "deactivate"
                ? "Deactivate"
                : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
