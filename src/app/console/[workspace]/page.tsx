import { notFound } from "next/navigation";
import { AdminConsolePage } from "@/components/admin/admin-console";
import { isWorkspaceKey } from "@/components/admin/console-workspaces";

export default async function ConsoleWorkspacePage({ params }: PageProps<"/console/[workspace]">) {
  const { workspace } = await params;
  if (!isWorkspaceKey(workspace) || workspace === "overview") notFound();
  return <AdminConsolePage workspace={workspace} />;
}
