import { AuthCard, AuthShell } from "@/components/auth/auth-shell";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell>
      <AuthCard>{children}</AuthCard>
    </AuthShell>
  );
}
