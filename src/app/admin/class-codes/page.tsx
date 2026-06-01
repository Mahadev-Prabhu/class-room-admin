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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TruncatedText } from "@/components/admin/TruncatedText";
import { toast } from "sonner";
import {
  fetchClassCodes,
  createClassCode,
  addTeacherToAdmin,
  assignTeacherCodeToSchool,
  updateClassCode,
  validateTeacherCode,
  fetchAdminTeachers,
} from "@/lib/firebase-service";
import { AdminTeacher, ClassCode, TeacherListItem } from "@/lib/types";
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
    return "Assigned";
  }

  return "Used";
};

const getStatusVariant = (status: string) => {
  if (status === "Expired") {
    return "destructive";
  }

  return "secondary";
};

const getStatusClassName = (status: string) =>
  status === "Assigned" ? "bg-green-600 text-white hover:bg-green-600" : "";

const isAlphanumeric = (value: string) => /^[a-z0-9]+$/i.test(value);

export default function ClassCodesPage() {
  const router = useRouter();
  const { admin } = useAuth();
  const [classCodes, setClassCodes] = useState<ClassCode[]>([]);
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [editingClassCode, setEditingClassCode] = useState<ClassCode | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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
      toast.error("Failed to load teacher codes");
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
      toast.error("Please enter a teacher code");
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

  const handleAddClassCode = async () => {
    const normalizedCode = newCode.trim().toUpperCase();

    if (!normalizedCode) {
      toast.error("Please enter a teacher code");
      return;
    }

    if (!isAlphanumeric(normalizedCode)) {
      toast.error("Class code can contain only letters and numbers");
      return;
    }

    if (classCodes.some((classCode) => classCode.code === normalizedCode)) {
      toast.error("This teacher code already exists");
      return;
    }

    if (admin?.role !== "super_admin" && !codeValidation.classCode) {
      toast.error("Please validate the teacher code first");
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
        error instanceof Error ? error.message : "Failed to add teacher code"
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
      toast.error("Failed to update teacher code");
    } finally {
      setIsUpdating(false);
    }
  };

  const getTeacherForCode = (code: string) => {
    return teachers.find((t) => t.teacherCode === code);
  };

  const filteredClassCodes = classCodes.filter((code) => {
    const query = searchQuery.trim().toLowerCase();
    const teacher = getTeacherForCode(code.code);
    const status = getClassCodeStatus(code);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teacher Codes</h1>
          <p className="text-muted-foreground">
            Manage and assign teacher codes to teachers
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
              {admin?.role === "super_admin" ? "Create Teacher Code" : "Add Teacher Code"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {admin?.role === "super_admin" ? "Create Teacher Code" : "Add Teacher Code"}
              </DialogTitle>
              <DialogDescription>
                {admin?.role === "super_admin"
                  ? "Create a new teacher code in the system"
                  : "Enter a teacher code to assign it to a teacher"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Teacher Code *</Label>
                <div className={admin?.role === "super_admin" ? "" : "flex gap-2"}>
                  <Input
                    id="code"
                    placeholder="e.g., EFHB775"
                    value={newCode}
                    onChange={(e) => {
                      setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
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
                {admin?.role !== "super_admin" && codeValidation.checked && (
                  <p
                    className={`text-sm ${
                      codeValidation.valid ? "text-green-600" : "text-yellow-600"
                    }`}
                  >
                    {codeValidation.valid
                      ? "✓ Valid teacher code found"
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
                  ? "Create Teacher Code"
                  : "Add Teacher Code"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {admin?.role === "super_admin" ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>All Teacher Codes</CardTitle>
                <CardDescription>
                  {filteredClassCodes.length} teacher code
                  {filteredClassCodes.length !== 1 ? "s" : ""} found
                </CardDescription>
              </div>
              <Input
                placeholder="Search teacher codes..."
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
                    ? "No teacher codes match your search."
                    : "No teacher codes found."}
                </p>
              </div>
            ) : (
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[12%] text-center">Code</TableHead>
                    <TableHead className="w-[22%] text-center">Used By</TableHead>
                    <TableHead className="w-[20%] text-center">Assigned School</TableHead>
                    <TableHead className="w-[13%] text-center">Student Limit</TableHead>
                    <TableHead className="w-[14%] text-center">Expiry Date</TableHead>
                    <TableHead className="w-[11%] text-center">Status</TableHead>
                    <TableHead className="w-[8%] text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClassCodes.map((code) => {
                    const status = getClassCodeStatus(code);

                    return (
                      <TableRow key={code.code}>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="font-mono">
                            {code.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="space-y-1">
                            <div className="font-medium">
                              {code.teacher_name || "-"}
                            </div>
                            {code.teacher_email && (
                              <div className="text-xs text-muted-foreground">
                                <TruncatedText
                                  value={code.teacher_email}
                                  maxChars={28}
                                />
                              </div>
                            )}
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
                              {new Date(code.expiration_date).toLocaleDateString()}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(code)}
                          >
                            Edit
                          </Button>
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
                <CardTitle>All Teacher Codes</CardTitle>
                <CardDescription>
                  {filteredClassCodes.length} teacher code
                  {filteredClassCodes.length !== 1 ? "s" : ""} found
                </CardDescription>
              </div>
              <Input
                placeholder="Search teacher codes..."
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
                    ? "No teacher codes match your search."
                    : "No teacher codes found."}
                </p>
                {!searchQuery.trim() && (
                  <p className="text-sm">
                    Click &quot;Add Teacher Code&quot; to get started.
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
                              {new Date(code.expiration_date).toLocaleDateString()}
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
            <DialogTitle>Edit Teacher Code</DialogTitle>
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

      {/* Delete Confirmation Dialog */}
    </div>
  );
}
