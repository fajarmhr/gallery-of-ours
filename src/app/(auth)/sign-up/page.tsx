import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getInviteForSignUp } from "@/lib/invites";

export const metadata: Metadata = { title: "Request access" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const { invite } = await searchParams;
  const token = typeof invite === "string" && invite.length <= 100 ? invite : null;
  const details = token ? await getInviteForSignUp(token) : null;
  return <SignUpForm invite={token ? { token, valid: Boolean(details), invitedBy: details?.invitedBy ?? null } : null} />;
}
