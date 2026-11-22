import { and, count, desc, eq, inArray, isNull, or, lte, sql } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { db } from "@/db";
import { albums, user as userTable } from "@/db/schema";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomBar } from "@/components/layout/bottom-bar";
import { Topbar } from "@/components/layout/topbar";
import { PageTransition } from "@/components/layout/page-transition";
import { UploadProvider } from "@/components/upload/upload-context";
import { cloudinaryAccountOptions } from "@/lib/cloudinary";
import { editableScope, isAdmin } from "@/lib/permissions";
import { requireActiveUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireActiveUser();
  const t = await getTranslations("nav");
  const td = await getTranslations("design");
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
    <UploadProvider
      albums={uploadAlbums}
      canCreateAlbum={scope === "all"}
      storageOptions={uploadAlbums.length ? cloudinaryAccountOptions() : []}
    >
      <a href="#main-content" className="skip-link">{td("skipToContent")}</a>
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
          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 pb-[calc(7rem+env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-8 outline-none sm:pl-[max(2rem,env(safe-area-inset-left))] sm:pr-[max(2rem,env(safe-area-inset-right))] sm:pt-10 lg:pb-16 lg:pl-10 lg:pr-10 xl:pl-12 xl:pr-12">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
      <BottomBar />
    </UploadProvider>
  );
}
