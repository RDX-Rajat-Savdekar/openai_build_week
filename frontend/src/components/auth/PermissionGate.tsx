import { type ReactNode } from "react";
import { PageHeader } from "@/components/layout/AppLayout";
import { Callout } from "@/components/ui/Callout";
import { usePermissions } from "@/context/PermissionsContext";
import { PERMISSION_LABELS, type PermissionKey } from "@/lib/permissions";

export function PermissionGate({
  permission,
  children,
  title = "Access denied",
}: {
  permission: PermissionKey;
  children: ReactNode;
  title?: string;
}) {
  const { can, loading } = usePermissions();

  if (loading) {
    return <PageHeader title={title} subtitle="Loading permissions…" />;
  }

  if (!can(permission)) {
    return (
      <>
        <PageHeader title={title} subtitle="Your role doesn't include this permission." />
        <Callout>
          Ask a workspace Admin to grant <b>{PERMISSION_LABELS[permission]}</b> in{" "}
          <a href="/app/roles" className="text-accent underline">
            Roles & permissions
          </a>
          .
        </Callout>
      </>
    );
  }

  return children;
}
