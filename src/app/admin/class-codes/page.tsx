"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  fetchClassCodes,
  createClassCode,
  deleteClassCode,
  validateTeacherCode,
  fetchTeachers,
} from "@/lib/firebase-service";
import { ClassCode, TeacherListItem } from "@/lib/types";
import { useAuth } from "@/contexts/AuthContext";

export default function ClassCodesPage() {
  const { admin } = useAuth();
  const [classCodes, setClassCodes] = useState<ClassCode[]>([]);
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteCode, setDeleteCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [newCode, setNewCode] = useState("");
  const [className, setClassName] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [studentLimit, setStudentLimit] = useState("");
  const [codeValidation, setCodeValidation] = useState<{
    checked: boolean;
    valid: boolean;
    teacher?: TeacherListItem;
  }>({ checked: false, valid: false });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [codesData, teachersData] = await Promise.all([
        fetchClassCodes(),
        fetchTeachers(),
      ]);
      setClassCodes(codesData);
      setTeachers(teachersData);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error("Failed to load class codes");
    } finally {
      setLoading(false);
    }
  }

  const handleValidateCode = async () => {
    if (!newCode.trim()) {
      toast.error("Please enter a class code");
      return;
    }

    try {
      const result = await validateTeacherCode(newCode.trim().toUpperCase());
      setCodeValidation({ checked: true, ...result });

      if (result.valid && result.teacher) {
        setTeacherName(result.teacher.name);
        setTeacherEmail(result.teacher.email);
        toast.success("Valid teacher code found!");
      } else {
        // Check if code is already in class_codes
        const existingCode = classCodes.find(
          (c) => c.code === newCode.trim().toUpperCase()
        );
        if (existingCode) {
          toast.error("This code is already assigned");
        } else {
          toast.info("Code not found in system. You can assign it to a new teacher.");
        }
      }
    } catch {
      toast.error("Failed to validate code");
    }
  };

  const handleAddClassCode = async () => {
    if (!newCode.trim()) {
      toast.error("Please enter a class code");
      return;
    }

    setIsSubmitting(true);

    try {
      const classCodeData: ClassCode = {
        code: newCode.trim().toUpperCase(),
        class_name: className || undefined,
        teacher_name: teacherName || undefined,
        teacher_email: teacherEmail || undefined,
        teacher_uid: codeValidation.teacher?.uid,
        school_admin_uid: admin?.uid,
        expiration_date: expirationDate || undefined,
        student_limit: studentLimit ? parseInt(studentLimit) : undefined,
        created_at: new Date().toISOString(),
      };

      await createClassCode(classCodeData);
      toast.success("Class code added successfully!");
      
      // Reset form
      setNewCode("");
      setClassName("");
      setTeacherName("");
      setTeacherEmail("");
      setExpirationDate("");
      setStudentLimit("");
      setCodeValidation({ checked: false, valid: false });
      setIsAddDialogOpen(false);
      
      // Reload data
      loadData();
    } catch {
      toast.error("Failed to add class code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCode = async () => {
    if (!deleteCode) return;

    try {
      await deleteClassCode(deleteCode);
      toast.success("Class code deleted successfully!");
      setDeleteCode(null);
      loadData();
    } catch {
      toast.error("Failed to delete class code");
    }
  };

  const getTeacherForCode = (code: string) => {
    return teachers.find((t) => t.teacherCode === code);
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
              Add Class Code
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Class Code</DialogTitle>
              <DialogDescription>
                Enter a class code to assign it to a teacher
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="code">Class Code *</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    placeholder="e.g., EFHB775"
                    value={newCode}
                    onChange={(e) => {
                      setNewCode(e.target.value.toUpperCase());
                      setCodeValidation({ checked: false, valid: false });
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleValidateCode}
                  >
                    Validate
                  </Button>
                </div>
                {codeValidation.checked && (
                  <p
                    className={`text-sm ${
                      codeValidation.valid ? "text-green-600" : "text-yellow-600"
                    }`}
                  >
                    {codeValidation.valid
                      ? "✓ Valid teacher code found"
                      : "Code not found - will be assigned to new teacher"}
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

              <div className="space-y-2">
                <Label htmlFor="className">Class Name</Label>
                <Input
                  id="className"
                  placeholder="e.g., Pre-K Room A"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiration">Expiration Date</Label>
                  <Input
                    id="expiration"
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="limit">Student Limit</Label>
                  <Input
                    id="limit"
                    type="number"
                    placeholder="e.g., 30"
                    value={studentLimit}
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
              <Button onClick={handleAddClassCode} disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Class Code"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Class Codes</CardTitle>
          <CardDescription>
            View and manage class codes assigned to your school
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : classCodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No class codes found.</p>
              <p className="text-sm">Click &quot;Add Class Code&quot; to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Class Name</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classCodes.map((code) => {
                  const teacher = getTeacherForCode(code.code);
                  return (
                    <TableRow key={code.code}>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">
                          {code.code}
                        </Badge>
                      </TableCell>
                      <TableCell>{code.class_name || "-"}</TableCell>
                      <TableCell>
                        {code.teacher_name || teacher?.name || "-"}
                      </TableCell>
                      <TableCell>
                        {code.teacher_email || teacher?.email || "-"}
                      </TableCell>
                      <TableCell>
                        {teacher?.studentCount || 0}
                        {code.student_limit && ` / ${code.student_limit}`}
                      </TableCell>
                      <TableCell>
                        {code.expiration_date ? (
                          <span
                            className={
                              new Date(code.expiration_date) < new Date()
                                ? "text-destructive"
                                : ""
                            }
                          >
                            {new Date(code.expiration_date).toLocaleDateString()}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteCode(code.code)}
                        >
                          Delete
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

      {/* Also show unassigned teachers */}
      <Card>
        <CardHeader>
          <CardTitle>Teachers in System</CardTitle>
          <CardDescription>
            Teachers registered in the app (may not have class codes assigned yet)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : teachers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No teachers found in the system.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teachers.map((teacher) => {
                  const isAssigned = classCodes.some(
                    (c) => c.code === teacher.teacherCode
                  );
                  return (
                    <TableRow key={teacher.uid}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {teacher.teacherCode}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {teacher.name}
                      </TableCell>
                      <TableCell>{teacher.email}</TableCell>
                      <TableCell>{teacher.school}</TableCell>
                      <TableCell>{teacher.studentCount}</TableCell>
                      <TableCell>
                        <Badge variant={isAssigned ? "default" : "secondary"}>
                          {isAssigned ? "Assigned" : "Not Assigned"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteCode} onOpenChange={() => setDeleteCode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Class Code?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete class code &quot;{deleteCode}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCode}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
