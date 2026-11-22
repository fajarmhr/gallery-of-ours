import { Hourglass, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthCard, AuthHeading, AuthShell } from "@/components/auth/auth-shell";
import { SignOutButton } from "@/components/preferences";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Waiting for approval" };

export default async function PendingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.status === "active") redirect("/home");

  const t = await getTranslations("auth");
  const rejected = user.status === "rejected";

  return (
    <AuthShell>
      <AuthCard>
        <AuthHeading
          icon={rejected ? <UserX className="size-7" /> : <Hourglass className="size-7" />}
          title={rejected ? t("rejectedTitle") : t("pendingTitle")}
          lead={rejected ? t("rejectedText") : t("pendingText")}
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          {!rejected ? (
            <Button asChild className="h-12 rounded-lg px-5 text-base">
              <Link href="/home">{t("checkAgain")}</Link>
            </Button>
          ) : null}
          <SignOutButton label={t("signOut")} className="h-12 rounded-lg text-base" />
        </div>
      </AuthCard>
    </AuthShell>
  );
}
