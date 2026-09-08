"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TruncatedText } from "@/components/admin/TruncatedText";
import { ArrowUpDown, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchClassCodes,
  createClassCode,
  addTeacherToAdmin,
  assignTeacherCodeToSchool,
  deleteClassCode,
  deleteExpiredTeacherCode,
  updateClassCode,
  validateTeacherCode,
  fetchAdminTeachers,
} from "@/lib/firebase-service";
import { AdminTeacher, ClassCode, TeacherListItem } from "@/lib/types";
import { formatUsDate } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const getLocalDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getTomorrowDateValue = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getLocalDateValue(tomorrow);
};

const isExpiredDate = (date: string) => date <= getLocalDateValue(new Date());

const getClassCodeStatus = (classCode: ClassCode) => {
  if (classCode.expiration_date && isExpiredDate(classCode.expiration_date)) {
    return "Expired";
  }

  if (!classCode.teacher_uid) {
    return "Available";
  }

  if (classCode.school_admin_uid) {
    return "School Assigned";
  }

  return "Teacher Claimed";
};

const canDirectDeleteClassCode = (classCode: ClassCode) =>
  !classCode.teacher_uid && !classCode.school_admin_uid;

const canDeleteClassCode = (classCode: ClassCode) =>
  ["Expired", "Teacher Claimed"].includes(getClassCodeStatus(classCode)) ||
  canDirectDeleteClassCode(classCode);

const getStatusVariant = (status: string) => {
  if (status === "Expired") {
    return "destructive";
  }

  return "secondary";
};

const getStatusClassName = (status: string) => {
  if (status === "School Assigned") {
    return "bg-green-100 text-green-800 hover:bg-green-100";
  }

  if (status === "Teacher Claimed") {
    return "bg-amber-100 text-amber-800 hover:bg-amber-100";
  }

  if (status === "Available") {
    return "bg-blue-100 text-blue-800 hover:bg-blue-100";
  }

  return "";
};

const TEACHER_CODE_PATTERN = /^E[A-Z0-9]{3}\d{2,4}$/;
const TEST_TEACHER_CODE_PATTERN = /^TEST\d{3,4}$/;
const TEACHER_CODE_REQUIREMENTS =
  "Teacher code must start with E, followed by 3 uppercase letters or numbers, and end with 2 to 4 numbers.";
const isValidTeacherCodeFormat = (value: string) =>
  TEACHER_CODE_PATTERN.test(value) || TEST_TEACHER_CODE_PATTERN.test(value);
type SortField = "status" | "school";
type SortDirection = "asc" | "desc";
type CodeTypeFilter = "all" | "test" | "live";
const STATUS_SORT_ORDER = {
  "School Assigned": 0,
  "Teacher Claimed": 1,
  Available: 2,
  Expired: 3,
} as const;

export default function ClassCodesPage() {
  const router = useRouter();
  const { admin } = useAuth();
  const [classCodes, setClassCodes] = useState<ClassCode[]>([]);
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [codeTypeFilter, setCodeTypeFilter] = useState<CodeTypeFilter>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [editingClassCode, setEditingClassCode] = useState<ClassCode | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingClassCode, setDeletingClassCode] = useState<ClassCode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>("status");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Form state
  const [newCode, setNewCode] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [studentLimit, setStudentLimit] = useState("");
  const [editExpirationDate, setEditExpirationDate] = useState("");
  const [editStudentLimit, setEditStudentLimit] = useState("");
  const [codeValidation, setCodeValidation] = useState<{
    checked: boolean;
    valid: boolean;
    message?: string;
    teacher?: TeacherListItem;
    classCode?: ClassCode;
  }>({ checked: false, valid: false });

  const loadData = useCallback(async () => {
    if (!admin) return;

    try {
      setLoading(true);
      const [codesData, teachersData] = await Promise.all([
        fetchClassCodes(),
        admin.role === "super_admin" ? Promise.resolve([]) : fetchAdminTeachers(admin.uid),
      ]);

      const assignedTeacherCodes = new Set(
        teachersData.map((teacher) => teacher.teacherCode)
      );
      setClassCodes(
        admin.role === "super_admin"
          ? codesData
          : codesData.filter(
              (code) =>
                code.school_admin_uid === admin.uid ||
                assignedTeacherCodes.has(code.code)
            )
      );
      setTeachers(teachersData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load class codes");
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    if (admin) {
      if (admin.role !== "super_admin") {
        router.push("/admin/teachers");
        return;
      }

      loadData();
    }
  }, [admin, loadData, router]);

  const handleValidateCode = async () => {
    if (!newCode.trim()) {
      toast.error("Please enter a class code");
      return;
    }

    setIsValidatingCode(true);

    try {
      const normalizedCode = newCode.trim().toUpperCase();
      const [result, allTeacherCodes] = await Promise.all([
        validateTeacherCode(normalizedCode),
        fetchClassCodes(),
      ]);
      const teacherCode = allTeacherCodes.find((code) => code.code === normalizedCode);

      if (!teacherCode) {
        setCodeValidation({ checked: true, valid: false, message: "Teacher code not found" });
        setExpirationDate("");
        setStudentLimit("");
        toast.error("Teacher code not found in class codes");
        return;
      }

      if (!teacherCode.teacher_uid) {
        setCodeValidation({ checked: true, valid: false, message: "This class code has not been used by a teacher yet" });
        setExpirationDate(teacherCode.expiration_date || "");
        setStudentLimit(teacherCode.student_limit?.toString() || "");
        toast.error("This class code has not been used by a teacher yet");
        return;
      }

      if (
        teacherCode.school_admin_uid &&
        teacherCode.school_admin_uid !== admin?.uid
      ) {
        setCodeValidation({ checked: true, valid: false, message: "This class code is already assigned to another school" });
        setExpirationDate(teacherCode.expiration_date || "");
        setStudentLimit(teacherCode.student_limit?.toString() || "");
        toast.error("This class code is already assigned to another school");
        return;
      }

      if (!result.valid || !result.teacher?.uid) {
        setCodeValidation({ checked: true, valid: false, message: "Teacher account not found" });
        setExpirationDate(teacherCode.expiration_date || "");
        setStudentLimit(teacherCode.student_limit?.toString() || "");
        toast.error("Teacher account not found for this code");
        return;
      }

      setCodeValidation({ checked: true, ...result, classCode: teacherCode });
      setExpirationDate(teacherCode.expiration_date || "");
      setStudentLimit(teacherCode.student_limit?.toString() || "");

      setTeacherName(result.teacher.name);
      setTeacherEmail(result.teacher.email);
      toast.success("Valid class code found!");
    } catch {
      toast.error("Failed to validate code");
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleAddClassCode = async () => {
    const normalizedCode = newCode.trim().toUpperCase();

    if (!normalizedCode) {
      toast.error("Please enter a class code");
      return;
    }

    if (admin?.role === "super_admin" && !isValidTeacherCodeFormat(normalizedCode)) {
      toast.error(TEACHER_CODE_REQUIREMENTS);
      return;
    }

    if (classCodes.some((classCode) => classCode.code === normalizedCode)) {
      toast.error("This class code already exists");
      return;
    }

    if (admin?.role !== "super_admin" && !codeValidation.classCode) {
      toast.error("Please validate the class code first");
      return;
    }

    if (admin?.role === "super_admin" && !expirationDate) {
      toast.error("Please select an expiry date");
      return;
    }

    if (expirationDate && expirationDate <= getLocalDateValue(new Date())) {
      toast.error("Expiration date must be greater than today's date");
      return;
    }

    if (admin?.role === "super_admin" && !studentLimit) {
      toast.error("Please enter a student limit");
      return;
    }

    if (studentLimit && parseInt(studentLimit) <= 0) {
      toast.error("Student limit must be greater than 0");
      return;
    }

    setIsSubmitting(true);

    try {
      if (admin?.role === "super_admin") {
        await createClassCode({
          code: normalizedCode,
          teacher_name: teacherName || undefined,
          teacher_email: teacherEmail || undefined,
          teacher_uid: codeValidation.teacher?.uid,
          expiration_date: expirationDate || undefined,
          student_limit: studentLimit ? parseInt(studentLimit) : undefined,
          created_at: new Date().toISOString(),
        });
      } else if (admin?.uid) {
        const teacherUid = codeValidation.classCode?.teacher_uid;
        if (!teacherUid) {
          toast.error("Teacher account not found for this code");
          return;
        }

        await assignTeacherCodeToSchool(normalizedCode, admin.uid);

        const adminTeacher: AdminTeacher = {
          uid: teacherUid,
          school_admin_uid: admin.uid,
          teacher_code: normalizedCode,
          assigned_at: new Date().toISOString(),
        };

        await addTeacherToAdmin(admin.uid, adminTeacher);
      }

      toast.success(
        admin?.role === "super_admin"
          ? "Class code created successfully!"
          : "Class code added successfully!"
      );
      
      // Reset form
      setNewCode("");
      setTeacherName("");
      setTeacherEmail("");
      setExpirationDate("");
      setStudentLimit("");
      setCodeValidation({ checked: false, valid: false });
      setIsAddDialogOpen(false);
      
      // Reload data
      loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add class code"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditDialog = (classCode: ClassCode) => {
    setEditingClassCode(classCode);
    setEditExpirationDate(classCode.expiration_date || "");
    setEditStudentLimit(classCode.student_limit?.toString() || "");
  };

  const handleUpdateClassCode = async () => {
    if (!editingClassCode) return;

    if (editExpirationDate && editExpirationDate <= getLocalDateValue(new Date())) {
      toast.error("Expiration date must be greater than today's date");
      return;
    }

    if (editStudentLimit && parseInt(editStudentLimit) <= 0) {
      toast.error("Student limit must be greater than 0");
      return;
    }

    setIsUpdating(true);

    try {
      await updateClassCode(editingClassCode.code, {
        expiration_date: editExpirationDate || null,
        student_limit: editStudentLimit ? parseInt(editStudentLimit) : null,
      });

      toast.success("Class code updated successfully!");
      setEditingClassCode(null);
      setEditExpirationDate("");
      setEditStudentLimit("");
      loadData();
    } catch {
      toast.error("Failed to update class code");
    } finally {
      setIsUpdating(false);
    }
  };

  const openDeleteDialog = (classCode: ClassCode) => {
    if (!canDeleteClassCode(classCode)) {
      toast.error("Only expired codes or unused codes can be deleted");
      return;
    }

    setDeletingClassCode(classCode);
  };

  const handleDeleteClassCode = async () => {
    if (!deletingClassCode) return;

    setIsDeleting(true);

    try {
      const status = getClassCodeStatus(deletingClassCode);

      if (status === "Expired" || status === "Teacher Claimed") {
        const summary = await deleteExpiredTeacherCode(deletingClassCode.code);
        toast.success(
          `Class code deleted. Removed ${summary.deletedChildProfiles} child profile${
            summary.deletedChildProfiles === 1 ? "" : "s"
          } and ${summary.deletedParentAccounts} parent account${
            summary.deletedParentAccounts === 1 ? "" : "s"
          }.`
        );
      } else {
        if (!canDirectDeleteClassCode(deletingClassCode)) {
          toast.error("Only expired, teacher claimed, or unused codes can be deleted");
          return;
        }

        await deleteClassCode(deletingClassCode.code);
        toast.success("Teacher code deleted successfully");
      }

      setDeletingClassCode(null);
      await loadData();
    } catch (error) {
      console.error("Failed to delete class code", error);

      const firebaseError = error as { code?: string; message?: string };
      toast.error(
        firebaseError.message ||
          firebaseError.code ||
          "Failed to delete class code"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const getTeacherForCode = (code: string) => {
    return teachers.find((t) => t.teacherCode === code);
  };

  const filteredClassCodes = classCodes.filter((code) => {
    const query = searchQuery.trim().toLowerCase();
    const teacher = getTeacherForCode(code.code);
    const status = getClassCodeStatus(code);
    const isTestCode = code.code.toUpperCase().startsWith("TEST");

    if (codeTypeFilter === "test" && !isTestCode) {
      return false;
    }

    if (codeTypeFilter === "live" && isTestCode) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [
      code.code,
      code.teacher_name,
      code.teacher_email,
      code.school_admin_name,
      code.expiration_date,
      code.student_limit?.toString(),
      status,
      teacher?.name,
      teacher?.email,
      teacher?.school,
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(query));
  });

  const getExpirationSortValue = (code: ClassCode) => {
    if (!code.expiration_date) {
      return Number.POSITIVE_INFINITY;
    }

    const date = new Date(code.expiration_date);
    return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
  };

  const sortedClassCodes = [...filteredClassCodes].sort((a, b) => {
    if (!sortField) {
      return 0;
    }

    const direction = sortDirection === "asc" ? 1 : -1;
    const statusA = getClassCodeStatus(a) as keyof typeof STATUS_SORT_ORDER;
    const statusB = getClassCodeStatus(b) as keyof typeof STATUS_SORT_ORDER;
    const statusComparison = STATUS_SORT_ORDER[statusA] - STATUS_SORT_ORDER[statusB];

    if (statusComparison !== 0) {
      return statusComparison * (sortField === "status" ? direction : 1);
    }

    if (sortField === "school" && statusA === "School Assigned") {
      return (
        (a.school_admin_name || "").localeCompare(b.school_admin_name || "") *
        direction
      );
    }

    return getExpirationSortValue(a) - getExpirationSortValue(b);
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection("asc");
  };

  const getSortLabel = (field: SortField) => {
    if (sortField !== field) {
      return "Sort";
    }

    return sortDirection === "asc" ? "Sorted ascending" : "Sorted descending";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Class Codes</h1>
          <p className="text-muted-foreground">
            Manage and assign class codes to teachers
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 mr-2"
              >
                <line x1="12" x2="12" y1="5" y2="19" />
                <line x1="5" x2="19" y1="12" y2="12" />
              </svg>
              {admin?.role === "super_admin" ? "Create Class Code" : "Add Class Code"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {admin?.role === "super_admin" ? "Create Class Code" : "Add Class Code"}
              </DialogTitle>
              <DialogDescription>
                {admin?.role === "super_admin"
                  ? "Create a new class code in the system"
                  : "Enter a class code to assign it to a teacher"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Class Code *</Label>
                <div className={admin?.role === "super_admin" ? "" : "flex gap-2"}>
                  <Input
                    id="code"
                    placeholder="e.g., EFHB775"
                    value={newCode}
                    onChange={(e) => {
                      setNewCode(
                        e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, "")
                          .slice(0, 8)
                      );
                      setCodeValidation({ checked: false, valid: false });
                      setTeacherName("");
                      setTeacherEmail("");
                      setExpirationDate("");
                      setStudentLimit("");
                    }}
                  />
                  {admin?.role !== "super_admin" && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleValidateCode}
                      disabled={isValidatingCode || isSubmitting}
                    >
                      {isValidatingCode ? "Validating..." : "Validate"}
                    </Button>
                  )}
                </div>
                {admin?.role === "super_admin" && (
                  <p className="text-xs text-muted-foreground">
                    Format: starts with E, then 3 uppercase letters/numbers,
                    then 2 to 4 numbers.
                  </p>
                )}
                {admin?.role !== "super_admin" && codeValidation.checked && (
                  <p
                    className={`text-sm ${
                      codeValidation.valid ? "text-green-600" : "text-yellow-600"
                    }`}
                  >
                    {codeValidation.valid
                      ? "✓ Valid class code found"
                      : codeValidation.message || "Teacher account not found"}
                  </p>
                )}
              </div>

              {admin?.role !== "super_admin" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="teacherName">Teacher Name</Label>
                      <Input
                        id="teacherName"
                        placeholder="John Smith"
                        value={teacherName}
                        onChange={(e) => setTeacherName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="teacherEmail">Teacher Email</Label>
                      <Input
                        id="teacherEmail"
                        type="email"
                        placeholder="teacher@school.com"
                        value={teacherEmail}
                        onChange={(e) => setTeacherEmail(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiration">Expiration Date</Label>
                  <Input
                    id="expiration"
                    type="date"
                    min={getTomorrowDateValue()}
                    value={expirationDate}
                    disabled={admin?.role !== "super_admin"}
                    onChange={(e) => setExpirationDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="limit">Student Limit</Label>
                  <Input
                    id="limit"
                    type="number"
                    min="1"
                    placeholder="e.g., 30"
                    value={studentLimit}
                    disabled={admin?.role !== "super_admin"}
                    onChange={(e) => setStudentLimit(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsAddDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddClassCode}
                disabled={
                  isSubmitting ||
                  isValidatingCode ||
                  (admin?.role !== "super_admin" && !codeValidation.classCode)
                }
              >
                {isSubmitting
                  ? admin?.role === "super_admin"
                    ? "Creating..."
                    : "Adding..."
                  : admin?.role === "super_admin"
                  ? "Create Class Code"
                  : "Add Class Code"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {admin?.role === "super_admin" ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle>
                  <Select
                    value={codeTypeFilter}
                    onValueChange={(value) =>
                      setCodeTypeFilter(value as CodeTypeFilter)
                    }
                  >
                    <SelectTrigger className="h-9 w-[190px] text-sm font-semibold">
                      <SelectValue placeholder="Code type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Class Codes</SelectItem>
                      <SelectItem value="test">Test Class Codes</SelectItem>
                      <SelectItem value="live">Live Class Codes</SelectItem>
                    </SelectContent>
                  </Select>
                </CardTitle>
                <CardDescription>
                  {filteredClassCodes.length} class code
                  {filteredClassCodes.length !== 1 ? "s" : ""} found
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <Input
                  placeholder="Search class codes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full md:w-[280px]"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredClassCodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>
                  {searchQuery.trim() || codeTypeFilter !== "all"
                    ? "No class codes match your filters."
                    : "No class codes found."}
                </p>
              </div>
            ) : (
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[12%] text-center">Code</TableHead>
                    <TableHead className="w-[17%] text-center">Used By</TableHead>
                    <TableHead className="w-[21%] text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mx-auto gap-1.5 px-2"
                        onClick={() => handleSort("school")}
                        aria-label={`${getSortLabel("school")} by assigned school`}
                      >
                        Assigned School
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[12%] text-center">Student Limit</TableHead>
                    <TableHead className="w-[15%] text-center">Expiry Date</TableHead>
                    <TableHead className="w-[13%] text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mx-auto gap-1.5 px-2"
                        onClick={() => handleSort("status")}
                        aria-label={`${getSortLabel("status")} by status`}
                      >
                        Status
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </Button>
                    </TableHead>
                    <TableHead className="w-[10%] text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedClassCodes.map((code) => {
                    const status = getClassCodeStatus(code);

                    return (
                      <TableRow key={code.code}>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-mono">
                            {code.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="font-medium">
                            {code.teacher_name || "-"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <TruncatedText
                            value={code.school_admin_name}
                            maxChars={24}
                            className="mx-auto"
                          />
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {code.student_limit || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {code.expiration_date ? (
                            <Badge
                              variant={status === "Expired" ? "destructive" : "outline"}
                              className="whitespace-nowrap font-normal"
                            >
                              {formatUsDate(code.expiration_date)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={getStatusVariant(status)}
                            className={getStatusClassName(status)}
                          >
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Edit class code ${code.code}`}
                              onClick={() => openEditDialog(code)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              aria-label={`Delete class code ${code.code}`}
                              disabled={!canDeleteClassCode(code)}
                              onClick={() => openDeleteDialog(code)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>All Class Codes</CardTitle>
                <CardDescription>
                  {filteredClassCodes.length} class code
                  {filteredClassCodes.length !== 1 ? "s" : ""} found
                </CardDescription>
              </div>
              <Input
                placeholder="Search class codes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-[280px]"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredClassCodes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>
                  {searchQuery.trim()
                    ? "No class codes match your search."
                    : "No class codes found."}
                </p>
                {!searchQuery.trim() && (
                  <p className="text-sm">
                    Click &quot;Add Class Code&quot; to get started.
                  </p>
                )}
              </div>
            ) : (
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[31%] text-center">Email</TableHead>
                    <TableHead className="w-[15%] text-center">Code</TableHead>
                    <TableHead className="w-[22%] text-center">Teacher</TableHead>
                    <TableHead className="w-[15%] text-center">Students</TableHead>
                    <TableHead className="w-[17%] text-center">Expiration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClassCodes.map((code) => {
                    const teacher = getTeacherForCode(code.code);
                    const isExpired = code.expiration_date
                      ? isExpiredDate(code.expiration_date)
                      : false;

                    return (
                      <TableRow key={code.code}>
                        <TableCell className="text-muted-foreground">
                          <TruncatedText
                            value={code.teacher_email || teacher?.email}
                            maxChars={28}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-mono">
                            {code.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          {code.teacher_name || teacher?.name || "-"}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          <span className="font-medium">{teacher?.studentCount || 0}</span>
                          <span className="text-muted-foreground">
                            {code.student_limit ? ` / ${code.student_limit}` : ""}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {code.expiration_date ? (
                            <Badge
                              variant={isExpired ? "destructive" : "outline"}
                              className="whitespace-nowrap font-normal"
                            >
                              {formatUsDate(code.expiration_date)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
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
      )}

      <Dialog
        open={!!editingClassCode}
        onOpenChange={(open) => {
          if (!open) {
            setEditingClassCode(null);
            setEditExpirationDate("");
            setEditStudentLimit("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Class Code</DialogTitle>
            <DialogDescription>
              Update expiration date and student limit for {editingClassCode?.code}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editExpiration">Expiration Date</Label>
              <Input
                id="editExpiration"
                type="date"
                min={getTomorrowDateValue()}
                value={editExpirationDate}
                onChange={(e) => setEditExpirationDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editStudentLimit">Student Limit</Label>
              <Input
                id="editStudentLimit"
                type="number"
                min="1"
                placeholder="e.g., 30"
                value={editStudentLimit}
                onChange={(e) => setEditStudentLimit(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingClassCode(null)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateClassCode} disabled={isUpdating}>
              {isUpdating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingClassCode}
        onOpenChange={(open) => {
          if (isDeleting) {
            return;
          }

          if (!open) {
            setDeletingClassCode(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete class code {deletingClassCode?.code}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {deletingClassCode &&
                ["Expired", "Teacher Claimed"].includes(
                  getClassCodeStatus(deletingClassCode)
                ) ? (
                  <>
                    <p>
                      This class code will be deleted using backend cleanup.
                    </p>
                    <div>
                      <p>This can permanently delete:</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>The teacher account using this code</li>
                        <li>Teacher-student links for this code</li>
                        <li>Child profiles connected to this class code</li>
                        <li>
                          Parent accounts only when all their child profiles are
                          connected to this code
                        </li>
                      </ul>
                    </div>
                    <p>
                      Firebase Auth users will be removed by the backend delete
                      trigger when their /users node is deleted.
                    </p>
                  </>
                ) : (
                  <p>
                    This unused class code will be permanently deleted from
                    /teacher_codes in Firebase.
                  </p>
                )}
                <p className="font-medium text-destructive">
                  This action cannot be undone.
                </p>
                {isDeleting && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting class code and cleaning related records...
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClassCode}
              disabled={isDeleting}
              className="inline-flex items-center bg-destructive text-white hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
