"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fetchTeachers } from "@/lib/firebase-service";
import { TeacherListItem } from "@/lib/types";

export default function TeachersPage() {
  const router = useRouter();
  const [teachers, setTeachers] = useState<TeacherListItem[]>([]);
  const [filteredTeachers, setFilteredTeachers] = useState<TeacherListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadTeachers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredTeachers(teachers);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredTeachers(
        teachers.filter(
          (teacher) =>
            teacher.name.toLowerCase().includes(query) ||
            teacher.email.toLowerCase().includes(query) ||
            teacher.teacherCode.toLowerCase().includes(query) ||
            teacher.school.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, teachers]);

  async function loadTeachers() {
    try {
      const data = await fetchTeachers();
      setTeachers(data);
      setFilteredTeachers(data);
    } catch (error) {
      console.error("Failed to load teachers:", error);
      toast.error("Failed to load teachers");
    } finally {
      setLoading(false);
    }
  }

  const handleViewStudents = (teacherCode: string) => {
    router.push(`/admin/students?teacher=${teacherCode}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Teachers</h1>
        <p className="text-muted-foreground">
          View and manage teachers in the system
        </p>
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
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teacher Code</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Last Sign In</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeachers.map((teacher) => (
                  <TableRow key={teacher.uid}>
                    <TableCell className="font-medium">{teacher.name}</TableCell>
                    <TableCell>{teacher.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono">
                        {teacher.teacherCode}
                      </Badge>
                    </TableCell>
                    <TableCell>{teacher.school}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{teacher.studentCount} students</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {teacher.lastSignIn
                        ? new Date(teacher.lastSignIn).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewStudents(teacher.teacherCode)}
                      >
                        View Students
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
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
    </div>
  );
}
