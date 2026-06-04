"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { TruncatedText } from "@/components/admin/TruncatedText";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { formatDisplayName, formatUsDate } from "@/lib/utils";
import {
  fetchStudents,
  fetchAdminStudents,
  fetchTeachers,
  fetchAdminTeachers,
  fetchClassCodes,
  deleteStudent,
  moveStudentsToTeacher,
  getTeacherByCode,
} from "@/lib/firebase-service";
import { ClassCode, StudentListItem, TeacherListItem } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

const getLocalDateValue = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export default function StudentsPage() {
  const { admin } = useAuth();
  const searchParams = useSearchParams();
  const teacherFilter = searchParams.get("teacher");

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentListItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [classCodes, setClassCodes] = useState<ClassCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>(teacherFilter || "all");

  // Delete state
  const [deleteStudentId, setDeleteStudentId] = useState<string | null>(null);
  const [deleteStudentEmail, setDeleteStudentEmail] = useState<string>("");

  // Move state
  const [moveStudent, setMoveStudent] = useState<{
    uid: string;
    parentEmail: string;
    children: StudentListItem["children"];
  } | null>(null);
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [newTeacherUid, setNewTeacherUid] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentListItem | null>(null);

  const loadData = useCallback(async () => {
    if (!admin) return;

    try {
      setLoading(true);
      const [studentsData, teachersData, codesData] = await Promise.all([
        admin.role === "super_admin" ? fetchStudents() : fetchAdminStudents(admin.uid),
        admin.role === "super_admin" ? fetchTeachers() : fetchAdminTeachers(admin.uid),
        fetchClassCodes(),
      ]);
      setStudents(studentsData);
      setTeachers(teachersData);
      setClassCodes(codesData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    if (admin) {
      loadData();
    }
  }, [admin, loadData]);

  useEffect(() => {
    let filtered = [...students];

    // Filter by teacher
    if (selectedTeacher && selectedTeacher !== "all") {
      filtered = filtered.filter((student) =>
        student.children.some(
          (child) =>
            child.teacherUid === selectedTeacher ||
            child.teacherCode === selectedTeacher
        )
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (student) =>
          student.parentEmail.toLowerCase().includes(query) ||
          student.children.some((child) =>
            child.name.toLowerCase().includes(query)
          )
      );
    }

    setFilteredStudents(filtered);
  }, [searchQuery, selectedTeacher, students]);

  const handleDeleteStudent = async () => {
    if (!deleteStudentId) return;

    try {
      await deleteStudent(deleteStudentId);
      toast.success("Student deleted successfully");
      setDeleteStudentId(null);
      setDeleteStudentEmail("");
      loadData();
    } catch {
      toast.error("Failed to delete student");
    }
  };

  const handleMoveStudent = async () => {
    if (!moveStudent || !newTeacherUid) {
      toast.error("Please select a teacher");
      return;
    }

    if (selectedChildIds.length === 0) {
      toast.error("Please select at least one child");
      return;
    }

    setIsMoving(true);

    try {
      const selectedTeacherData = teachers.find((teacher) => teacher.uid === newTeacherUid);
      if (!selectedTeacherData) {
        toast.error("Teacher not found");
        return;
      }

      const teacherData = await getTeacherByCode(selectedTeacherData.teacherCode);
      if (!teacherData) {
        toast.error("Teacher not found");
        return;
      }

      const targetCode = getClassCodeForTeacher(selectedTeacherData.uid);
      if (!targetCode) {
        toast.error("Selected teacher code not found");
        return;
      }

      if (isClassCodeExpired(targetCode)) {
        toast.error("Selected teacher code is expired");
        return;
      }

      const availableSeats = getAvailableSeats(selectedTeacherData.uid);
      if (availableSeats !== null && selectedChildIds.length > availableSeats) {
        toast.error(
          `Student limit exceeded. This teacher can accept ${availableSeats} more student${
            availableSeats === 1 ? "" : "s"
          }.`
        );
        return;
      }

      await moveStudentsToTeacher(
        moveStudent.uid,
        selectedChildIds,
        selectedTeacherData.teacherCode,
        selectedTeacherData.uid
      );

      toast.success(
        `${selectedChildIds.length} child${
          selectedChildIds.length === 1 ? "" : "ren"
        } moved to ${formatDisplayName(teacherData.teacher.teacher_details.teacher_name)}`
      );
      closeMoveDialog();
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to move student");
    } finally {
      setIsMoving(false);
    }
  };

  const closeMoveDialog = () => {
    setMoveStudent(null);
    setSelectedChildIds([]);
    setNewTeacherUid("");
  };

  const getTeacherName = (code: string) => {
    const teacher = teachers.find((t) => t.teacherCode === code);
    return teacher?.name || "Unknown";
  };

  const getClassCodeForTeacher = (teacherUid: string) => {
    return classCodes.find((code) => code.teacher_uid === teacherUid);
  };

  const isClassCodeExpired = (classCode?: ClassCode) => {
    return !!classCode?.expiration_date && classCode.expiration_date <= getLocalDateValue();
  };

  const getAvailableSeats = (teacherUid: string) => {
    const teacher = teachers.find((item) => item.uid === teacherUid);
    const classCode = getClassCodeForTeacher(teacherUid);

    if (!teacher || !classCode?.student_limit) {
      return null;
    }

    return Math.max(classCode.student_limit - teacher.studentCount, 0);
  };

  const getMoveTargetTeachers = () => {
    return teachers.filter((teacher) => {
      if (!moveStudent) {
        return false;
      }

      const selectedChildren =
        selectedChildIds.length > 0
          ? moveStudent.children.filter((child) => selectedChildIds.includes(child.id))
          : moveStudent.children;
      const isCurrentTeacherForAllSelected = selectedChildren.every(
        (child) =>
          child.teacherUid === teacher.uid || child.teacherCode === teacher.teacherCode
      );
      const classCode = getClassCodeForTeacher(teacher.uid);
      const availableSeats = getAvailableSeats(teacher.uid);

      return (
        !isCurrentTeacherForAllSelected &&
        !!classCode &&
        !isClassCodeExpired(classCode) &&
        (availableSeats === null || availableSeats > 0)
      );
    });
  };

  const canMoveStudent = (student: StudentListItem) => {
    return teachers.some((teacher) =>
      student.children.some(
        (child) =>
          teacher.uid !== child.teacherUid &&
          teacher.teacherCode !== child.teacherCode &&
          !!getClassCodeForTeacher(teacher.uid) &&
          !isClassCodeExpired(getClassCodeForTeacher(teacher.uid)) &&
          (getAvailableSeats(teacher.uid) === null || getAvailableSeats(teacher.uid)! > 0)
      )
    );
  };

  const toggleSelectedChild = (childId: string) => {
    setSelectedChildIds((current) =>
      current.includes(childId)
        ? current.filter((id) => id !== childId)
        : [...current, childId]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Students</h1>
        <p className="text-muted-foreground">
          View and manage student accounts and their children
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>All Students</CardTitle>
              <CardDescription>
                {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""} found
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <Select
                value={selectedTeacher}
                onValueChange={setSelectedTeacher}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by teacher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teachers</SelectItem>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.uid} value={teacher.uid}>
                      {teacher.name} ({teacher.teacherCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Search by email or child name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[250px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || selectedTeacher !== "all"
                ? "No students match your filters."
                : "No students found."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Parent Email</TableHead>
                  <TableHead className="text-center">Children</TableHead>
                  <TableHead className="text-center">Teacher</TableHead>
                  <TableHead className="text-center">Last Used</TableHead>
                  <TableHead className="w-[80px] text-center">Info</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => {
                  const uniqueTeacherCodes = Array.from(
                    new Set(student.children.map((child) => child.teacherCode || "-"))
                  );
                  const sharedTeacherCode =
                    uniqueTeacherCodes.length === 1 ? uniqueTeacherCodes[0] : null;

                  return (
                      <TableRow key={student.uid}>
                        <TableCell className="font-medium">
                          <TruncatedText value={student.parentEmail} maxChars={28} />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            {student.children.map((child) => (
                              <div
                                key={child.id}
                                className="rounded-md border bg-muted/25 px-3 py-2"
                              >
                                <div className="font-medium leading-5">{child.name}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>{child.age || "Age not set"}</span>
                                  <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                                  <span>{child.booksRead} books read</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {sharedTeacherCode ? (
                            <div className="flex flex-col items-center gap-1 text-center">
                              <span className="text-sm font-medium">
                                {getTeacherName(sharedTeacherCode)}
                              </span>
                              <Badge variant="secondary" className="font-mono text-xs">
                                {sharedTeacherCode}
                              </Badge>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {student.children.map((child) => (
                                <div
                                  key={child.id}
                                  className="flex min-h-[68px] flex-col items-center justify-center rounded-md border border-transparent px-3 py-2 text-center"
                                >
                                  <span className="text-sm font-medium">
                                    {getTeacherName(child.teacherCode)}
                                  </span>
                                  <Badge variant="secondary" className="font-mono text-xs">
                                    {child.teacherCode || "-"}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground text-sm">
                      {formatUsDate(student.lastUsed, "Never")}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                            aria-label={`View details for ${student.parentEmail}`}
                            onClick={() => setSelectedStudent(student)}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            {canMoveStudent(student) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setMoveStudent({
                                    uid: student.uid,
                                    parentEmail: student.parentEmail,
                                    children: student.children,
                                  });
                                  setSelectedChildIds(
                                    student.children.length === 1
                                      ? [student.children[0].id]
                                      : []
                                  );
                                  setNewTeacherUid("");
                                }}
                              >
                                Move
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setDeleteStudentId(student.uid);
                                setDeleteStudentEmail(student.parentEmail);
                              }}
                            >
                              Delete
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

      {/* Student Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Parent Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{students.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Children
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {students.reduce((sum, s) => sum + s.children.length, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Books Read
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {students
                .reduce(
                  (sum, s) =>
                    sum + s.children.reduce((cSum, c) => cSum + c.booksRead, 0),
                  0
                )
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Points Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {students
                .reduce(
                  (sum, s) =>
                    sum + s.children.reduce((cSum, c) => cSum + c.totalPoints, 0),
                  0
                )
                .toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!selectedStudent}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStudent(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[720px]">
          {selectedStudent && (
            <>
              <DialogHeader>
                <DialogTitle>Student Details</DialogTitle>
                <DialogDescription>
                  Full child details for {selectedStudent.parentEmail}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5">
                <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      Parent Email
                    </div>
                    <div className="break-words text-sm font-medium">
                      {selectedStudent.parentEmail}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium uppercase text-muted-foreground">
                      Last Used
                    </div>
                    <div className="text-sm font-medium">
                      {formatUsDate(selectedStudent.lastUsed, "Never")}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {selectedStudent.children.map((child) => (
                    <div key={child.id} className="rounded-md border p-3">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{child.name}</div>
                        </div>
                        <Badge variant="outline">{child.age}</Badge>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <div className="text-xs font-medium uppercase text-muted-foreground">
                            Teacher Code
                          </div>
                          <Badge variant="secondary" className="font-mono">
                            {child.teacherCode || "-"}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium uppercase text-muted-foreground">
                            Teacher Name
                          </div>
                          <div className="text-sm">{getTeacherName(child.teacherCode)}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium uppercase text-muted-foreground">
                            Books Read
                          </div>
                          <div className="text-sm tabular-nums">{child.booksRead}</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-medium uppercase text-muted-foreground">
                            Total Points
                          </div>
                          <div className="text-sm tabular-nums">
                            {child.totalPoints.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Move Student Dialog */}
      <Dialog
        open={!!moveStudent}
        onOpenChange={(open) => {
          if (!open) {
            closeMoveDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Student to Another Class</DialogTitle>
            <DialogDescription>
              Select one or more children from {moveStudent?.parentEmail} and move
              them to a different teacher.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Children</Label>
              <div className="space-y-2">
                {moveStudent?.children.map((child) => {
                  const isSelected = selectedChildIds.includes(child.id);

                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => toggleSelectedChild(child.id)}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <span className="font-medium">{child.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {getTeacherName(child.teacherCode)} ({child.teacherCode})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newTeacher">Select New Teacher</Label>
              <Select value={newTeacherUid} onValueChange={setNewTeacherUid}>
                <SelectTrigger id="newTeacher">
                  <SelectValue placeholder="Select a teacher" />
                </SelectTrigger>
                <SelectContent>
                  {getMoveTargetTeachers().map((teacher) => {
                    const seats = getAvailableSeats(teacher.uid);

                    return (
                      <SelectItem key={teacher.uid} value={teacher.uid}>
                        {teacher.name} ({teacher.teacherCode})
                        {seats !== null
                          ? ` - ${seats} seat${seats === 1 ? "" : "s"}`
                          : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {getMoveTargetTeachers().length === 0 && (
              <p className="text-sm text-muted-foreground">
                No eligible teachers found. Teacher code must be active and have
                enough student limit.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeMoveDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleMoveStudent}
              disabled={isMoving || !newTeacherUid || selectedChildIds.length === 0}
            >
              {isMoving
                ? "Moving..."
                : `Move ${selectedChildIds.length || ""} Student${
                    selectedChildIds.length === 1 ? "" : "s"
                  }`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteStudentId}
        onOpenChange={() => {
          setDeleteStudentId(null);
          setDeleteStudentEmail("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student Account?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Are you sure you want to delete the account for{" "}
                  <strong>{deleteStudentEmail}</strong>? This will permanently remove:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>The parent account</li>
                  <li>All child profiles</li>
                  <li>All reading progress and rewards</li>
                </ul>
                <p className="mt-2 text-destructive font-medium">
                  This action cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStudent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
