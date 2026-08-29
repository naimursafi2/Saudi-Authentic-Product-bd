"use client";

import { MyUploads } from "@/components/assets/MyUploads";
import { usePermissionGate } from "@/components/admin/RoleGuard";
import { EmptyState } from "@/components/admin/EmptyState";
import { FileStack } from "lucide-react";

export default function AdminMyUploadsPage() {
  const allowed = usePermissionGate("assets.request_delete", "assets.manage");
  if (!allowed) {
    return <EmptyState icon={FileStack} title="Access restricted" description="You cannot view internal uploads." />;
  }
  return <MyUploads />;
}
