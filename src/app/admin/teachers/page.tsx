"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TruncatedText } from "@/components/admin/TruncatedText";
import { ArrowUpDown, Info, Mail, Plus, Share2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  fetchAdminTeachers,
  fetchClassCodes,
  fetchTeachers,
  addTeacherToAdmin,
  assignTeacherCodeToSchool,
  createPendingReplacementTeacherAccount,
  createTeacherAccountForSchool,
  deletePendingTeacher,
  sendTeacherPasswordResetEmail,
  validateTeacherCode,
  transferTeacherAssignment,
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

const getDateAfterDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return getLocalDateValue(date);
};

const isAlphanumeric = (value: string) => /^[a-z0-9]+$/i.test(value);

const isClassCodePendingStatus = (status?: string) =>
  status === "class_code_pending" || status === "pending_replacement";

const getTeacherStatusLabel = (status?: string) => {
  if (isClassCodePendingStatus(status)) {
    return "Class Code Pending";
  }

  if (status === "replaced") {
    return "No Longer Active";
  }

  return "";
};

type SortDirection = "asc" | "desc";
type SortField = "school" | "lastSignIn";

export default function TeachersPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schoolFilter = searchParams.get("school");
  const { admin } = useAuth();
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<TeacherListItem[]>([]);
  const [classCodes, setClassCodes] = useState<ClassCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [transferTeacher, setTransferTeacher] = useState<TeacherListItem | null>(null);
  const [targetTeacherUid, setTargetTeacherUid] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [deleteTeacher, setDeleteTeacher] = useState<TeacherListItem | null>(null);
  const [isDeletingTeacher, setIsDeletingTeacher] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherListItem | null>(null);
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);
  const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false);
  const [isReplacementDialogOpen, setIsReplacementDialogOpen] = useState(false);
  const [teacherDialogMode, setTeacherDialogMode] = useState<"existing" | "new">("existing");
  const [isSubmittingCode, setIsSubmittingCode] = useState(false);
  const [isCreatingTeacher, setIsCreatingTeacher] = useState(false);
  const [isCreatingReplacementTeacher, setIsCreatingReplacementTeacher] = useState(false);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [isValidatingCreateCode, setIsValidatingCreateCode] = useState(false);
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [newCode, setNewCode] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [studentLimit, setStudentLimit] = useState("");
  const [codeValidation, setCodeValidation] = useState<{
    checked: boolean;
    valid: boolean;
    message?: string;
    teacher?: TeacherListItem;
    classCode?: ClassCode;
  }>({ checked: false, valid: false });
  const [createTeacherCode, setCreateTeacherCode] = useState("");
  const [createTeacherEmail, setCreateTeacherEmail] = useState("");
  const [createTeacherPassword, setCreateTeacherPassword] = useState("");
  const [createTeacherExpirationDate, setCreateTeacherExpirationDate] = useState("");
  const [createTeacherStudentLimit, setCreateTeacherStudentLimit] = useState("");
  const [createCodeValidation, setCreateCodeValidation] = useState<{
    checked: boolean;
    valid: boolean;
    message?: string;
    classCode?: ClassCode;
  }>({ checked: false, valid: false });
  const [replacementTeacherName, setReplacementTeacherName] = useState("");
  const [replacementTeacherEmail, setReplacementTeacherEmail] = useState("");
  const [replacementTeacherPassword, setReplacementTeacherPassword] = useState("");

  const loadTeachers = useCallback(async () => {
    if (!admin) return;

    try {
      setLoading(true);
        const [data, codesData] = await Promise.all([
          admin.role === "super_admin"
            ? fetchTeachers()
            : fetchAdminTeachers(admin.uid),
          fetchClassCodes(),
        ]);
      setTeachers(data);
      setFilteredTeachers(data);
      setClassCodes(codesData);
    } catch (error) {
      console.error("Failed to load teachers:", error);
      toast.error("Failed to load teachers");
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  useEffect(() => {
    let filtered = [...teachers];

    if (admin?.role === "super_admin" && schoolFilter) {
      const schoolTeacherUids = new Set(
        classCodes
          .filter((code) => code.school_admin_uid === schoolFilter && code.teacher_uid)
          .map((code) => code.teacher_uid)
      );

      filtered = filtered.filter((teacher) => schoolTeacherUids.has(teacher.uid));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (teacher) =>
          teacher.name.toLowerCase().includes(query) ||
          teacher.email.toLowerCase().includes(query) ||
          teacher.teacherCode.toLowerCase().includes(query) ||
          teacher.status?.toLowerCase().includes(query) ||
          teacher.school.toLowerCase().includes(query)
      );
    }

    setFilteredTeachers(filtered);
  }, [admin?.role, classCodes, schoolFilter, searchQuery, teachers]);

  const handleViewStudents = (teacherUid: string) => {
    router.push(`/admin/students?teacher=${teacherUid}`);
  };

  const canShareTeacherLogin = (teacher: TeacherListItem | null) =>
    Boolean(
      teacher &&
        teacher.teacherCode &&
        !isClassCodePendingStatus(teacher.status) &&
        teacher.status !== "replaced"
    );

  const canDeleteTeacher = (teacher: TeacherListItem) =>
    !teacher.teacherCode && teacher.studentCount === 0;

  const handleSendTeacherResetLink = async (teacher: TeacherListItem) => {
    if (!canShareTeacherLogin(teacher)) {
      toast.error("Transfer a class before sharing login details");
      return;
    }

    if (!teacher.email || teacher.email === "Unknown") {
      toast.error("Teacher email is not available");
      return;
    }

    setIsSendingResetLink(true);

    try {
      await sendTeacherPasswordResetEmail(teacher.email);
      toast.success("Reset password link sent");
    } catch {
      toast.error("Failed to send password reset link");
    } finally {
      setIsSendingResetLink(false);
    }
  };

  const handleShareTeacherDetails = async (teacher: TeacherListItem) => {
    if (!canShareTeacherLogin(teacher)) {
      toast.error("Transfer a class before sharing login details");
      return;
    }

    const message = [
      "Your Early Learning Library teacher account is ready.",
      `Email: ${teacher.email}`,
      `Teacher Code: ${teacher.teacherCode}`,
      "Please sign in to the app and complete your teacher profile. Use the reset password link if you need to set or reset your password.",
    ].join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Teacher account details",
          text: message,
        });
        return;
      }

      await navigator.clipboard.writeText(message);
      toast.success("Teacher details copied");
    } catch {
      toast.error("Failed to share teacher details");
    }
  };

  const handleDeleteTeacher = async () => {
    if (!admin || !deleteTeacher) {
      return;
    }

    if (!canDeleteTeacher(deleteTeacher)) {
      toast.error("Only teachers without a class code and students can be deleted");
      return;
    }

    setIsDeletingTeacher(true);

    try {
      await deletePendingTeacher(deleteTeacher.uid, admin);
      toast.success("Teacher deleted successfully");
      setDeleteTeacher(null);

      if (selectedTeacher?.uid === deleteTeacher.uid) {
        setSelectedTeacher(null);
      }

      await loadTeachers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete teacher"
      );
    } finally {
      setIsDeletingTeacher(false);
    }
  };

  const getAssignedCodeForTeacher = (teacherUid: string) => {
    return classCodes.find(
      (code) => code.teacher_uid === teacherUid && code.school_admin_uid
    );
  };

  const getTeacherCodeRecord = (teacher: TeacherListItem | null) => {
    if (!teacher) return undefined;

    return classCodes.find(
      (code) =>
        code.teacher_uid === teacher.uid ||
        code.code === teacher.teacherCode
    );
  };

  const getTransferTargets = () => {
    if (!transferTeacher) {
      return [];
    }

    return teachers.filter((teacher) => {
      const hasActiveAssignedCode = classCodes.some(
        (code) => code.teacher_uid === teacher.uid && code.school_admin_uid
      );

      return (
        teacher.uid !== transferTeacher.uid &&
        isClassCodePendingStatus(teacher.status) &&
        !hasActiveAssignedCode &&
        teacher.studentCount === 0
      );
    });
  };

  const closeTransferDialog = () => {
    setTransferTeacher(null);
    setTargetTeacherUid("");
  };

  const handleTransferAssignment = async () => {
    if (!transferTeacher || !targetTeacherUid) {
      toast.error("Please select a teacher");
      return;
    }

    const assignedCode = getAssignedCodeForTeacher(transferTeacher.uid);
    if (!assignedCode) {
      toast.error("This teacher does not have an assigned teacher code");
      return;
    }

    setIsTransferring(true);

    try {
      await transferTeacherAssignment(
        assignedCode.code,
        transferTeacher.uid,
        targetTeacherUid
      );
      toast.success("Teacher assignment transferred successfully");
      closeTransferDialog();

      const [teachersData, codesData] = await Promise.all([
        fetchTeachers(),
        fetchClassCodes(),
      ]);
      setTeachers(teachersData);
      setFilteredTeachers(teachersData);
      setClassCodes(codesData);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to transfer teacher assignment"
      );
    } finally {
      setIsTransferring(false);
    }
  };

  const resetAddTeacherCodeForm = () => {
    setNewCode("");
    setTeacherName("");
    setTeacherEmail("");
    setExpirationDate("");
    setStudentLimit("");
    setCodeValidation({ checked: false, valid: false });
  };

  const resetCreateTeacherForm = () => {
    setCreateTeacherCode("");
    setCreateTeacherEmail("");
    setCreateTeacherPassword("");
    setCreateTeacherExpirationDate("");
    setCreateTeacherStudentLimit("");
    setCreateCodeValidation({ checked: false, valid: false });
  };

  const resetReplacementTeacherForm = () => {
    setReplacementTeacherName("");
    setReplacementTeacherEmail("");
    setReplacementTeacherPassword("");
  };

  const handleCreateReplacementTeacher = async () => {
    if (admin?.role !== "super_admin") return;

    const normalizedName = replacementTeacherName.trim();
    const normalizedEmail = replacementTeacherEmail.trim().toLowerCase();

    if (!normalizedName) {
      toast.error("Please enter teacher name");
      return;
    }

    if (!normalizedEmail) {
      toast.error("Please enter teacher email");
      return;
    }

    if (!replacementTeacherPassword) {
      toast.error("Please enter a temporary password");
      return;
    }

    if (replacementTeacherPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsCreatingReplacementTeacher(true);

    try {
      await createPendingReplacementTeacherAccount(
        normalizedName,
        normalizedEmail,
        replacementTeacherPassword,
        admin.uid
      );
      toast.success("Replacement teacher account created successfully");
      resetReplacementTeacherForm();
      setIsReplacementDialogOpen(false);
      await loadTeachers();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create replacement teacher"
      );
    } finally {
      setIsCreatingReplacementTeacher(false);
    }
  };

  const handleValidateCreateTeacherCode = async () => {
    const normalizedCode = createTeacherCode.trim().toUpperCase();

    if (!normalizedCode) {
      toast.error("Please enter a teacher code");
      return;
    }

    setIsValidatingCreateCode(true);

    try {
      const allTeacherCodes = await fetchClassCodes();
      const teacherCode = allTeacherCodes.find((code) => code.code === normalizedCode);

      if (!teacherCode) {
        setCreateCodeValidation({ checked: true, valid: false, message: "Teacher code not found" });
        setCreateTeacherExpirationDate("");
        setCreateTeacherStudentLimit("");
        toast.error("Teacher code not found");
        return;
      }

      if (teacherCode.teacher_uid) {
        setCreateCodeValidation({
          checked: true,
          valid: false,
          message: "This teacher code is already used by another teacher",
        });
        setCreateTeacherExpirationDate(teacherCode.expiration_date || "");
        setCreateTeacherStudentLimit(teacherCode.student_limit?.toString() || "");
        toast.error("This teacher code is already used by another teacher");
        return;
      }

      if (teacherCode.school_admin_uid) {
        setCreateCodeValidation({
          checked: true,
          valid: false,
          message: "This teacher code is already assigned to another school",
        });
        setCreateTeacherExpirationDate(teacherCode.expiration_date || "");
        setCreateTeacherStudentLimit(teacherCode.student_limit?.toString() || "");
        toast.error("This teacher code is already assigned to another school");
        return;
      }

      const calculatedExpirationDate =
        teacherCode.expiration_date ||
        (typeof teacherCode.valid_days_after_applied === "number"
          ? getDateAfterDays(teacherCode.valid_days_after_applied)
          : "");

      if (calculatedExpirationDate && calculatedExpirationDate <= getLocalDateValue(new Date())) {
        setCreateCodeValidation({
          checked: true,
          valid: false,
          message: "This teacher code is expired",
        });
        setCreateTeacherExpirationDate(calculatedExpirationDate);
        setCreateTeacherStudentLimit(teacherCode.student_limit?.toString() || "");
        toast.error("This teacher code is expired");
        return;
      }

      setCreateTeacherExpirationDate(calculatedExpirationDate);
      setCreateTeacherStudentLimit(teacherCode.student_limit?.toString() || "");
      setCreateCodeValidation({
        checked: true,
        valid: true,
        message: "Valid unused teacher code",
        classCode: teacherCode,
      });
      toast.success("Valid unused teacher code");
    } catch {
      toast.error("Failed to validate teacher code");
    } finally {
      setIsValidatingCreateCode(false);
    }
  };

  const handleCreateTeacherAccount = async () => {
    if (!admin || admin.role === "super_admin") return;

    const normalizedEmail = createTeacherEmail.trim().toLowerCase();
    const normalizedCode = createTeacherCode.trim().toUpperCase();

    if (!createCodeValidation.classCode) {
      toast.error("Please validate the teacher code first");
      return;
    }

    if (!normalizedEmail) {
      toast.error("Please enter teacher email");
      return;
    }

    if (!createTeacherPassword) {
      toast.error("Please enter a temporary password");
      return;
    }

    if (createTeacherPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setIsCreatingTeacher(true);

    try {
      await createTeacherAccountForSchool(
        admin.uid,
        normalizedEmail,
        createTeacherPassword,
        normalizedCode
      );
      toast.success("Teacher account created successfully");
      resetCreateTeacherForm();
      setIsTeacherDialogOpen(false);
      await loadTeachers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create teacher account"
      );
    } finally {
      setIsCreatingTeacher(false);
    }
  };

  const handleValidateCode = async () => {
    const normalizedCode = newCode.trim().toUpperCase();

    if (!normalizedCode) {
      toast.error("Please enter a teacher code");
      return;
    }

    setIsValidatingCode(true);

    try {
      const [result, allTeacherCodes] = await Promise.all([
        validateTeacherCode(normalizedCode),
        fetchClassCodes(),
      ]);
      const teacherCode = allTeacherCodes.find((code) => code.code === normalizedCode);

      if (!teacherCode) {
        setCodeValidation({ checked: true, valid: false, message: "Teacher code not found" });
        setExpirationDate("");
        setStudentLimit("");
        toast.error("Teacher code not found in teacher codes");
        return;
      }

      if (!teacherCode.teacher_uid) {
        setCodeValidation({ checked: true, valid: false, message: "This teacher code has not been used by a teacher yet" });
        setExpirationDate(teacherCode.expiration_date || "");
        setStudentLimit(teacherCode.student_limit?.toString() || "");
        toast.error("This teacher code has not been used by a teacher yet");
        return;
      }

      if (
        teacherCode.school_admin_uid &&
        teacherCode.school_admin_uid !== admin?.uid
      ) {
        setCodeValidation({ checked: true, valid: false, message: "This teacher code is already assigned to another school" });
        setExpirationDate(teacherCode.expiration_date || "");
        setStudentLimit(teacherCode.student_limit?.toString() || "");
        toast.error("This teacher code is already assigned to another school");
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
      toast.success("Valid teacher code found!");
    } catch {
      toast.error("Failed to validate code");
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleAddTeacherCode = async () => {
    if (!admin || admin.role === "super_admin") return;

    const normalizedCode = newCode.trim().toUpperCase();

    if (!normalizedCode) {
      toast.error("Please enter a teacher code");
      return;
    }

    if (!isAlphanumeric(normalizedCode)) {
      toast.error("Teacher code can contain only letters and numbers");
      return;
    }

    if (teachers.some((teacher) => teacher.teacherCode === normalizedCode)) {
      toast.error("This teacher code is already assigned to your school");
      return;
    }

    if (!codeValidation.classCode) {
      toast.error("Please validate the teacher code first");
      return;
    }

    if (expirationDate && expirationDate <= getLocalDateValue(new Date())) {
      toast.error("Expiration date must be greater than today's date");
      return;
    }

    setIsSubmittingCode(true);

    try {
      const teacherUid = codeValidation.classCode.teacher_uid;
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

      toast.success("Teacher code added successfully!");
      resetAddTeacherCodeForm();
      setIsTeacherDialogOpen(false);
      await loadTeachers();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add teacher code"
      );
    } finally {
      setIsSubmittingCode(false);
    }
  };

  const formatLastSignIn = (lastSignIn: string) => {
    if (!lastSignIn || lastSignIn === "Never") {
      return "Never";
    }

    return formatUsDate(lastSignIn, "Never");
  };

  const getLastSignInSortValue = (lastSignIn: string) => {
    if (!lastSignIn || lastSignIn === "Never") {
      return Number.NEGATIVE_INFINITY;
    }

    const normalizedDate = lastSignIn.includes(" ")
      ? lastSignIn.replace(" ", "T")
      : lastSignIn;
    const date = new Date(normalizedDate);

    return Number.isNaN(date.getTime())
      ? Number.NEGATIVE_INFINITY
      : date.getTime();
  };

  const isTestTeacherCode = (teacher: TeacherListItem) =>
    teacher.teacherCode.toUpperCase().startsWith("TEST");

  const sortedTeachers = [...filteredTeachers].sort((a, b) => {
    const codeTypeComparison = Number(isTestTeacherCode(a)) - Number(isTestTeacherCode(b));

    if (codeTypeComparison !== 0) {
      return codeTypeComparison;
    }

    if (!sortField) {
      return 0;
    }

    if (sortField === "school") {
      return (
        a.school.localeCompare(b.school) * (sortDirection === "asc" ? 1 : -1)
      );
    }

    const aValue = getLastSignInSortValue(a.lastSignIn);
    const bValue = getLastSignInSortValue(b.lastSignIn);

    if (aValue === Number.NEGATIVE_INFINITY && bValue === Number.NEGATIVE_INFINITY) {
      return 0;
    }

    if (aValue === Number.NEGATIVE_INFINITY) {
      return 1;
    }

    if (bValue === Number.NEGATIVE_INFINITY) {
      return -1;
    }

    return sortDirection === "asc"
      ? aValue - bValue
      : bValue - aValue;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortField(field);
    setSortDirection(field === "lastSignIn" ? "desc" : "asc");
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
          <h1 className="text-3xl font-bold tracking-tight">Teachers</h1>
          <p className="text-muted-foreground">
            View and manage teachers {admin?.role === "super_admin" ? "in the system" : "connected to your school"}
          </p>
        </div>
        {admin?.role === "super_admin" ? (
          <Button
            onClick={() => setIsReplacementDialogOpen(true)}
            className="shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Replacement Teacher
          </Button>
        ) : (
          <Button
            onClick={() => setIsTeacherDialogOpen(true)}
            className="shadow-sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Teacher
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Teachers</CardTitle>
              <CardDescription>
                {filteredTeachers.length} teacher{filteredTeachers.length !== 1 ? "s" : ""} found
              </CardDescription>
            </div>
            <div className="w-72">
              <Input
                placeholder="Search by name, email, code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredTeachers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No teachers match your search." : "No teachers found."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Email</TableHead>
                  <TableHead className="text-center">Name</TableHead>
                  <TableHead className="text-center">Teacher Code</TableHead>
                  <TableHead className="text-center">Students</TableHead>
                  <TableHead className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mx-auto gap-1.5 px-2"
                      onClick={() => handleSort("school")}
                      aria-label={`${getSortLabel("school")} by school`}
                    >
                      School
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mx-auto gap-1.5 px-2"
                      onClick={() => handleSort("lastSignIn")}
                      aria-label={`${getSortLabel("lastSignIn")} by last sign in`}
                    >
                      Last Sign In
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[80px] text-center">Info</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTeachers.map((teacher) => {
                  const assignedCode = getAssignedCodeForTeacher(teacher.uid);

                  return (
                    <TableRow key={teacher.uid}>
                      <TableCell>
                        <TruncatedText value={teacher.email} maxChars={28} />
                      </TableCell>
                      <TableCell className="text-center font-medium">{teacher.name}</TableCell>
                      <TableCell className="text-center">
                        {teacher.teacherCode ? (
                          <Badge variant="secondary" className="font-mono">
                            {teacher.teacherCode}
                          </Badge>
                        ) : teacher.status ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                            {getTeacherStatusLabel(teacher.status) || teacher.status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                          onClick={() => handleViewStudents(teacher.uid)}
                        >
                          <Users className="h-3.5 w-3.5" />
                          {teacher.studentCount} students
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        <TruncatedText
                          value={teacher.school}
                          maxChars={24}
                          className="mx-auto"
                        />
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground text-sm">
                        {formatLastSignIn(teacher.lastSignIn)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                          aria-label={`View details for ${teacher.name}`}
                          onClick={() => setSelectedTeacher(teacher)}
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="text-center">
                        {assignedCode || canDeleteTeacher(teacher) ? (
                          <div className="flex justify-center gap-2">
                            {admin?.role === "super_admin" && assignedCode && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                                onClick={() => setTransferTeacher(teacher)}
                              >
                                Transfer Class
                              </Button>
                            )}
                            {canDeleteTeacher(teacher) && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                aria-label={`Delete ${teacher.name}`}
                                onClick={() => setDeleteTeacher(teacher)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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

      {/* Teacher Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Teachers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{teachers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Students Managed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {teachers.reduce((sum, t) => sum + t.studentCount, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Students per Teacher
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {teachers.length > 0
                ? Math.round(
                    teachers.reduce((sum, t) => sum + t.studentCount, 0) /
                      teachers.length
                  )
                : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!selectedTeacher}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTeacher(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          {selectedTeacher && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTeacher.name}</DialogTitle>
                <DialogDescription>Teacher account and assignment details</DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      Email
                    </div>
                    <div className="break-words text-sm font-medium">
                      {selectedTeacher.email}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      Teacher Code
                    </div>
                    <Badge variant="secondary" className="w-fit font-mono">
                      {selectedTeacher.teacherCode || "-"}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      School
                    </div>
                    <div className="text-sm font-medium">{selectedTeacher.school}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      Last Sign In
                    </div>
                    <div className="text-sm font-medium">
                      {formatLastSignIn(selectedTeacher.lastSignIn)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border p-3 text-center">
                    <div className="text-2xl font-bold tabular-nums">
                      {selectedTeacher.studentCount}
                      {getTeacherCodeRecord(selectedTeacher)?.student_limit
                        ? ` / ${getTeacherCodeRecord(selectedTeacher)?.student_limit}`
                        : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">Students</div>
                  </div>
                  <div className="rounded-md border p-3 text-center">
                    <div className="text-2xl font-bold tabular-nums">
                      {selectedTeacher.classAssignmentsCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Class Assignments</div>
                  </div>
                  <div className="rounded-md border p-3 text-center">
                    <div className="text-2xl font-bold tabular-nums">
                      {selectedTeacher.individualAssignmentsCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Individual Assignments</div>
                  </div>
                </div>

                {canShareTeacherLogin(selectedTeacher) ? (
                  <div className="flex flex-col gap-2 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-medium">Teacher login details</div>
                      <div className="text-xs text-muted-foreground">
                        Send a reset link or share the email and teacher code.
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                        onClick={() => handleSendTeacherResetLink(selectedTeacher)}
                        disabled={isSendingResetLink}
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {isSendingResetLink
                          ? "Sending..."
                          : "Send reset password link"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                        onClick={() => handleShareTeacherDetails(selectedTeacher)}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Share details
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                    Transfer a class to this teacher before sharing login details.
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isTeacherDialogOpen}
        onOpenChange={(open) => {
          setIsTeacherDialogOpen(open);
          if (!open) {
            resetAddTeacherCodeForm();
            resetCreateTeacherForm();
            setTeacherDialogMode("existing");
          }
        }}
      >
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Add Teacher</DialogTitle>
            <DialogDescription>
              Add an existing teacher by code or create a new teacher account.
            </DialogDescription>
          </DialogHeader>
          <Tabs
            value={teacherDialogMode}
            onValueChange={(value) =>
              setTeacherDialogMode(value as "existing" | "new")
            }
            className="pt-2"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger
                value="existing"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Existing Teacher
              </TabsTrigger>
              <TabsTrigger
                value="new"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                New Account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="existing">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="teacherCode">Teacher Code *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="teacherCode"
                      placeholder="e.g., EFHB775"
                      value={newCode}
                      onChange={(event) => {
                        setNewCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
                        setTeacherName("");
                        setTeacherEmail("");
                        setExpirationDate("");
                        setStudentLimit("");
                        setCodeValidation({ checked: false, valid: false });
                      }}
                      disabled={isSubmittingCode}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleValidateCode}
                      disabled={isValidatingCode || isSubmittingCode}
                    >
                      {isValidatingCode ? "Validating..." : "Validate"}
                    </Button>
                  </div>
                  {codeValidation.checked && (
                    <p
                      className={`text-sm ${
                        codeValidation.valid ? "text-green-600" : "text-yellow-600"
                      }`}
                    >
                      {codeValidation.valid
                        ? "Valid teacher code found"
                        : codeValidation.message || "Teacher account not found"}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="teacherName">Teacher Name</Label>
                    <Input
                      id="teacherName"
                      placeholder="John Smith"
                      value={teacherName}
                      onChange={(event) => setTeacherName(event.target.value)}
                      disabled={isSubmittingCode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="teacherEmail">Teacher Email</Label>
                    <Input
                      id="teacherEmail"
                      type="email"
                      placeholder="teacher@school.com"
                      value={teacherEmail}
                      onChange={(event) => setTeacherEmail(event.target.value)}
                      disabled={isSubmittingCode}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiration">Expiration Date</Label>
                    <Input id="expiration" type="date" value={expirationDate} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="limit">Student Limit</Label>
                    <Input id="limit" type="number" value={studentLimit} disabled />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsTeacherDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddTeacherCode}
                  disabled={isSubmittingCode || isValidatingCode || !codeValidation.classCode}
                >
                  {isSubmittingCode ? "Adding..." : "Add Teacher Code"}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="new">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="createTeacherCode">Teacher Code *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="createTeacherCode"
                      placeholder="e.g., EFHB775"
                      value={createTeacherCode}
                      onChange={(event) => {
                        setCreateTeacherCode(
                          event.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, "")
                            .slice(0, 8)
                        );
                        setCreateTeacherExpirationDate("");
                        setCreateTeacherStudentLimit("");
                        setCreateCodeValidation({ checked: false, valid: false });
                      }}
                      disabled={isCreatingTeacher}
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleValidateCreateTeacherCode}
                      disabled={isValidatingCreateCode || isCreatingTeacher}
                    >
                      {isValidatingCreateCode ? "Validating..." : "Validate"}
                    </Button>
                  </div>
                  {createCodeValidation.checked && (
                    <p
                      className={`text-sm ${
                        createCodeValidation.valid ? "text-green-600" : "text-yellow-600"
                      }`}
                    >
                      {createCodeValidation.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="createExpiration">Expiration Date</Label>
                    <Input
                      id="createExpiration"
                      type="date"
                      value={createTeacherExpirationDate}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="createLimit">Student Limit</Label>
                    <Input
                      id="createLimit"
                      type="number"
                      value={createTeacherStudentLimit}
                      disabled
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="createTeacherEmail">Teacher Email *</Label>
                  <Input
                    id="createTeacherEmail"
                    type="email"
                    placeholder="teacher@school.com"
                    value={createTeacherEmail}
                    onChange={(event) => setCreateTeacherEmail(event.target.value)}
                    disabled={isCreatingTeacher}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="createTeacherPassword">Temporary Password *</Label>
                  <Input
                    id="createTeacherPassword"
                    type="password"
                    value={createTeacherPassword}
                    onChange={(event) => setCreateTeacherPassword(event.target.value)}
                    disabled={isCreatingTeacher}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsTeacherDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTeacherAccount}
                  disabled={
                    isCreatingTeacher ||
                    isValidatingCreateCode ||
                    !createCodeValidation.classCode
                  }
                >
                  {isCreatingTeacher ? "Creating..." : "Create Teacher Account"}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isReplacementDialogOpen}
        onOpenChange={(open) => {
          setIsReplacementDialogOpen(open);
          if (!open) {
            resetReplacementTeacherForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Replacement Teacher</DialogTitle>
            <DialogDescription>
              Create a pending replacement teacher account without a teacher
              code. Use Transfer Class later to transfer an existing class code
              and students to this teacher.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="replacementTeacherName">Teacher Name *</Label>
              <Input
                id="replacementTeacherName"
                placeholder="Teacher name"
                value={replacementTeacherName}
                onChange={(event) => setReplacementTeacherName(event.target.value)}
                disabled={isCreatingReplacementTeacher}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replacementTeacherEmail">Teacher Email *</Label>
              <Input
                id="replacementTeacherEmail"
                type="email"
                placeholder="teacher@school.com"
                value={replacementTeacherEmail}
                onChange={(event) => setReplacementTeacherEmail(event.target.value)}
                disabled={isCreatingReplacementTeacher}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="replacementTeacherPassword">
                Temporary Password *
              </Label>
              <Input
                id="replacementTeacherPassword"
                type="password"
                value={replacementTeacherPassword}
                onChange={(event) =>
                  setReplacementTeacherPassword(event.target.value)
                }
                disabled={isCreatingReplacementTeacher}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReplacementDialogOpen(false)}
              disabled={isCreatingReplacementTeacher}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateReplacementTeacher}
              disabled={isCreatingReplacementTeacher}
            >
              {isCreatingReplacementTeacher
                ? "Creating..."
                : "Create Replacement Teacher"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!transferTeacher}
        onOpenChange={(open) => {
          if (!open) {
            closeTransferDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Transfer Class</DialogTitle>
            <DialogDescription>
              Transfer {transferTeacher?.name}&apos;s teacher code and students to
              a replacement teacher.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Teacher Code</Label>
              <div>
                <Badge variant="secondary" className="font-mono">
                  {transferTeacher
                    ? getAssignedCodeForTeacher(transferTeacher.uid)?.code ||
                      transferTeacher.teacherCode
                    : "-"}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetTeacher">Replacement Teacher</Label>
              <Select value={targetTeacherUid} onValueChange={setTargetTeacherUid}>
                <SelectTrigger id="targetTeacher">
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {getTransferTargets().map((teacher) => (
                    <SelectItem key={teacher.uid} value={teacher.uid}>
                      {teacher.name} ({teacher.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {getTransferTargets().length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No eligible replacement teachers found. Create a teacher with
                  Class Code Pending status first.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeTransferDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleTransferAssignment}
              disabled={isTransferring || !targetTeacherUid}
            >
              {isTransferring ? "Transferring..." : "Transfer Class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTeacher}
        onOpenChange={(open) => {
          if (!open && !isDeletingTeacher) {
            setDeleteTeacher(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete teacher?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete {deleteTeacher?.name || "this teacher"} from the admin
              portal? This is allowed only because the teacher has no active
              class code and no students. The database record will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTeacher}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault();
                handleDeleteTeacher();
              }}
              disabled={isDeletingTeacher}
            >
              {isDeletingTeacher ? "Deleting..." : "Delete Teacher"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
