import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getInviteForSignUp, maskEmail } from "@/lib/invites";

export const metadata: Metadata = { title: "Request access" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { invite } = await searchParams;
  const token = typeof invite === "string" && invite.length <= 100 ? invite : null;
  const details = token ? await getInviteForSignUp(token) : null;
  return (
    <SignUpForm
      invite={
        token
          ? {
              token,
              valid: Boolean(details),
              invitedBy: details?.invitedBy ?? null,
              // Someone who already made the account but closed the page comes back straight to the code step.
              pendingEmail: details?.pendingEmail ? maskEmail(details.pendingEmail) : null,
            }
          : null
      }
    />
  );
}
