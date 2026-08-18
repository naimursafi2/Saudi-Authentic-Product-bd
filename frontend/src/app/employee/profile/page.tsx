"use client";

import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { ProfileSection } from "@/components/account/ProfileSection";
import { AddressBook } from "@/components/account/AddressBook";

export default function EmployeeProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Profile" description="Manage your photo, contact details, password and address." />
      <ProfileSection user={user} />
      <AddressBook addresses={user.addresses} />
    </div>
  );
}
