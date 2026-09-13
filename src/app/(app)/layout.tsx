import { and, count, desc, eq, inArray, isNull, or, lte, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { db } from "@/db";
import { albums, user as userTable } from "@/db/schema";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomBar } from "@/components/layout/bottom-bar";
import { Topbar } from "@/components/layout/topbar";
import { UploadProvider } from "@/components/upload/upload-context";
import { editableScope, isAdmin } from "@/lib/permissions";
import { requireActiveUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireActiveUser();
  const t = await getTranslations("nav");
  const scope = await editableScope(user);

  const uploadAlbums =
    scope === "all" || scope.length
      ? await db
          .select({ id: albums.id, title: albums.title })
          .from(albums)
          .where(
            and(
              isNull(albums.deletedAt),
              scope === "all" ? undefined : inArray(albums.id, scope),
              or(isNull(albums.unlockAt), lte(albums.unlockAt, sql`now()`), eq(albums.createdById, user.id)),
            ),
          )
          .orderBy(desc(albums.createdAt))
      : [];

  let pendingCount = 0;
  if (isAdmin(user)) {
    const [row] = await db
      .select({ value: count() })
      .from(userTable)
      .where(and(eq(userTable.status, "pending"), eq(userTable.emailVerified, true)));
    pendingCount = row?.value ?? 0;
  }

  const sinceYear = process.env.NEXT_PUBLIC_FAMILY_SINCE;

  return (
    <UploadProvider albums={uploadAlbums} canCreateAlbum={scope === "all"}>
      <div className="flex min-h-dvh">
        <AppSidebar
          user={{ name: user.name, image: user.image, role: user.role }}
          pendingCount={pendingCount}
          since={sinceYear ? t("since", { year: sinceYear }) : undefined}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense>
            <Topbar user={{ name: user.name, image: user.image }} />
          </Suspense>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pb-12">{children}</main>
        </div>
      </div>
      <BottomBar />
    </UploadProvider>
  );
}
