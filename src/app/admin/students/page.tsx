"use client";

import { useEffect, useState } from "react";
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
import { toast } from "sonner";
import {
  fetchStudents,
  fetchTeachers,
  deleteStudent,
  moveStudentToTeacher,
  getTeacherByCode,
} from "@/lib/firebase-service";
import { StudentListItem, TeacherListItem } from "@/lib/types";

export default function StudentsPage() {
  const searchParams = useSearchParams();
  const teacherFilter = searchParams.get("teacher");

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<StudentListItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState<string>(teacherFilter || "all");

  // Delete state
  const [deleteStudentId, setDeleteStudentId] = useState<string | null>(null);
  const [deleteStudentEmail, setDeleteStudentEmail] = useState<string>("");

  // Move state
  const [moveStudent, setMoveStudent] = useState<{
    uid: string;
    childId: string;
    childName: string;
    currentTeacher: string;
  } | null>(null);
  const [newTeacherCode, setNewTeacherCode] = useState("");
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let filtered = [...students];

    // Filter by teacher
    if (selectedTeacher && selectedTeacher !== "all") {
      filtered = filtered.filter((student) =>
        student.children.some((child) => child.teacherCode === selectedTeacher)
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

  async function loadData() {
    try {
      const [studentsData, teachersData] = await Promise.all([
        fetchStudents(),
        fetchTeachers(),
      ]);
      setStudents(studentsData);
      setTeachers(teachersData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  }

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
    if (!moveStudent || !newTeacherCode) {
      toast.error("Please select a teacher");
      return;
    }

    setIsMoving(true);

    try {
      const teacherData = await getTeacherByCode(newTeacherCode);
      if (!teacherData) {
        toast.error("Teacher not found");
        return;
      }

      await moveStudentToTeacher(
        moveStudent.uid,
        moveStudent.childId,
        newTeacherCode,
        teacherData.uid
      );

      toast.success(`${moveStudent.childName} moved to ${teacherData.teacher.teacher_details.teacher_name}`);
      setMoveStudent(null);
      setNewTeacherCode("");
      loadData();
    } catch {
      toast.error("Failed to move student");
    } finally {
      setIsMoving(false);
    }
  };

  const getTeacherName = (code: string) => {
    const teacher = teachers.find((t) => t.teacherCode === code);
    return teacher?.name || "Unknown";
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
                    <SelectItem key={teacher.teacherCode} value={teacher.teacherCode}>
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
                  <TableHead>Parent Email</TableHead>
                  <TableHead>Children</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Books Read</TableHead>
                  <TableHead>Total Points</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.uid}>
                    <TableCell className="font-medium">
                      {student.parentEmail}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {student.children.map((child) => (
                          <div key={child.id} className="flex items-center gap-2">
                            <span>{child.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {child.age}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {student.children.map((child) => (
                          <div key={child.id}>
                            <Badge variant="secondary" className="font-mono text-xs">
                              {child.teacherCode}
                            </Badge>
                            <span className="ml-1 text-xs text-muted-foreground">
                              {getTeacherName(child.teacherCode)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.children.reduce((sum, c) => sum + c.booksRead, 0)}
                    </TableCell>
                    <TableCell>
                      {student.children
                        .reduce((sum, c) => sum + c.totalPoints, 0)
                        .toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {student.lastUsed || "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {student.children.map((child) => (
                          <Button
                            key={`move-${child.id}`}
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setMoveStudent({
                                uid: student.uid,
                                childId: child.id,
                                childName: child.name,
                                currentTeacher: child.teacherCode,
                              })
                            }
                          >
                            Move
                          </Button>
                        ))}
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
                ))}
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

      {/* Move Student Dialog */}
      <Dialog open={!!moveStudent} onOpenChange={() => setMoveStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Student to Another Class</DialogTitle>
            <DialogDescription>
              Move {moveStudent?.childName} from{" "}
              {getTeacherName(moveStudent?.currentTeacher || "")} to a different
              teacher.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newTeacher">Select New Teacher</Label>
            <Select value={newTeacherCode} onValueChange={setNewTeacherCode}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a teacher" />
              </SelectTrigger>
              <SelectContent>
                {teachers
                  .filter((t) => t.teacherCode !== moveStudent?.currentTeacher)
                  .map((teacher) => (
                    <SelectItem key={teacher.teacherCode} value={teacher.teacherCode}>
                      {teacher.name} ({teacher.teacherCode})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveStudent(null)}>
              Cancel
            </Button>
            <Button onClick={handleMoveStudent} disabled={isMoving || !newTeacherCode}>
              {isMoving ? "Moving..." : "Move Student"}
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
            <AlertDialogDescription>
              Are you sure you want to delete the account for{" "}
              <strong>{deleteStudentEmail}</strong>? This will permanently remove:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>The parent account</li>
                <li>All child profiles</li>
                <li>All reading progress and rewards</li>
              </ul>
              <p className="mt-2 text-destructive font-medium">
                This action cannot be undone.
              </p>
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
