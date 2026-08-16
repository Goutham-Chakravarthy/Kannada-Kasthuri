import { notFound } from "next/navigation";
import { ADMIN_SECRET_PATH } from "@/lib/auth";
import { AdminDashboard } from "@/components/AdminDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PageProps {
  params: Promise<{ adminSlug: string }>;
}

export default async function DynamicAdminPortalPage({ params }: PageProps) {
  const { adminSlug } = await params;

  // If the URL slug does not match the configured secret path, return standard 404
  if (adminSlug !== ADMIN_SECRET_PATH) {
    notFound();
  }

  return <AdminDashboard />;
}
