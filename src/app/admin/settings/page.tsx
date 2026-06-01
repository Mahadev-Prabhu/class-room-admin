"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { updateAdmin } from "@/lib/firebase-service";
import { SchoolDetails } from "@/lib/types";
import { formatDisplayName } from "@/lib/utils";

export default function SettingsPage() {
  const { admin, logout } = useAuth();
  const signInDetails = admin?.sign_in_details;
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSignOutDialogOpen, setIsSignOutDialogOpen] = useState(false);
  const [formData, setFormData] = useState<SchoolDetails>(
    admin?.school_details || {
      school_name: "",
      country: "",
      state: "",
      address_1: "",
      address_2: "",
      zip_code: "",
      phone: "",
    }
  );

  const handleChange = (field: keyof SchoolDetails, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!admin) return;

    setIsSaving(true);
    try {
      await updateAdmin(admin.uid, { school_details: formData });
      toast.success("Settings saved successfully");
      setIsEditing(false);
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(
      admin?.school_details || {
        school_name: "",
        country: "",
        state: "",
        address_1: "",
        address_2: "",
        zip_code: "",
        phone: "",
      }
    );
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and school settings
        </p>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your admin account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-muted-foreground">Name</Label>
              <p className="font-medium">{formatDisplayName(signInDetails?.name)}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium">{signInDetails?.email || signInDetails?.sign_in_email}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Role</Label>
              <div>
                <Badge variant="secondary">
                  {admin?.role === "super_admin"
                    ? "Super Admin"
                    : admin?.role === "school_admin"
                    ? "School Admin"
                    : "Viewer"}
                </Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Account Created</Label>
              <p className="font-medium">
                {signInDetails?.created_at
                  ? new Date(signInDetails.created_at).toLocaleDateString()
                  : "Unknown"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {admin?.role !== "super_admin" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>School Information</CardTitle>
                <CardDescription>Your school or center details</CardDescription>
              </div>
              {!isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="school_name">School/Center Name</Label>
                  <Input
                    id="school_name"
                    value={formData.school_name}
                    onChange={(e) => handleChange("school_name", e.target.value)}
                  />
                </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_1">Street Address 1</Label>
                <Input
                  id="address_1"
                  value={formData.address_1}
                  onChange={(e) => handleChange("address_1", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_2">Street Address 2</Label>
                <Input
                  id="address_2"
                  value={formData.address_2}
                  onChange={(e) => handleChange("address_2", e.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="zip_code">Zip Code</Label>
                  <Input
                    id="zip_code"
                    value={formData.zip_code}
                    onChange={(e) => handleChange("zip_code", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">School Name</Label>
                  <p className="font-medium">
                    {formatDisplayName(admin?.school_details?.school_name) || "Not set"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">
                    {admin?.school_details?.phone || "Not set"}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Address</Label>
                <p className="font-medium">
                  {admin?.school_details?.address_1 ? (
                    <>
                      {admin.school_details.address_1}
                      {admin.school_details.address_2 && (
                        <>, {admin.school_details.address_2}</>
                      )}
                      <br />
                      {admin.school_details.state}, {admin.school_details.zip_code}
                      <br />
                      {admin.school_details.country}
                    </>
                  ) : (
                    "Not set"
                  )}
                </p>
              </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sign Out</CardTitle>
              <p className="text-sm text-muted-foreground">
                Sign out of your admin account
              </p>
            </div>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setIsSignOutDialogOpen(true)}
            >
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={isSignOutDialogOpen} onOpenChange={setIsSignOutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to access the admin portal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => logout()}
              className="bg-destructive text-white hover:bg-destructive/90 hover:text-white"
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
