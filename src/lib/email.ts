import { Resend } from "resend";
import { env } from "@/lib/env";

type Locale = "en" | "id";
type Email = { subject: string; html: string; text: string };

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

/** Sends through Resend; without RESEND_API_KEY the email is printed to the server log instead. */
export async function sendEmail(to: string, email: Email) {
  if (!resend) {
    console.info(
      [
        "",
        "──────────── Email (no RESEND_API_KEY, printed instead) ────────────",
        `To:      ${to}`,
        `Subject: ${email.subject}`,
        "",
        email.text,
        "─────────────────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return;
  }
  const { error } = await resend.emails.send({
    from: env.emailFrom,
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
  if (error) throw new Error(`Email to ${to} failed: ${error.message}`);
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function render(heading: string, paragraphs: string[], cta?: { label: string; url: string }, footnote?: string, code?: string): Email {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#4a3c31">${escapeHtml(p)}</p>`).join("");
  const codeBox = code
    ? `<p style="margin:22px 0;padding:14px 0;border-radius:12px;background:#efe7da;text-align:center;font-family:Consolas,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:.3em;color:#2e241d">${escapeHtml(code)}</p>`
    : "";
  const button = cta
    ? `<p style="margin:22px 0"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#b4552f;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px">${escapeHtml(cta.label)}</a></p>`
    : "";
  const foot = footnote ? `<p style="margin:18px 0 0;font-size:12px;color:#7c6a5b">${escapeHtml(footnote)}</p>` : "";
  const html = `<!doctype html><html><body style="margin:0;background:#efe7da;padding:32px 16px;font-family:Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#fbf7f0;border:1px solid #e2d6c4;border-radius:18px"><tr><td style="padding:28px">
<p style="margin:0 0 18px;font-size:13px;font-weight:700;letter-spacing:.02em;color:#9a4424">Gallery of Ours</p>
<h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;color:#2e241d">${escapeHtml(heading)}</h1>
${body}${codeBox}${button}${foot}
</td></tr></table></body></html>`;
  const text = [
    heading,
    "",
    ...paragraphs,
    ...(code ? ["", code] : []),
    ...(cta ? ["", `${cta.label}: ${cta.url}`] : []),
    ...(footnote ? ["", footnote] : []),
  ].join("\n");
  return { subject: heading, html, text };
}

export const emails = {
  /** `invited`: the account came from an invite link, so no admin review follows. */
  verify(locale: Locale, name: string, url: string, invited = false) {
    return locale === "id"
      ? render(
          "Konfirmasi email Anda",
          [
            `Halo ${name},`,
            invited
              ? "Klik tombol di bawah untuk mengonfirmasi email Anda. Setelah itu Anda langsung bisa masuk ke galeri keluarga."
              : "Klik tombol di bawah untuk mengonfirmasi email Anda. Setelah itu admin keluarga akan meninjau permintaan Anda.",
          ],
          { label: "Konfirmasi email", url },
          "Tautan berlaku 24 jam. Abaikan email ini jika Anda tidak mendaftar.",
        )
      : render(
          "Confirm your email",
          [
            `Hi ${name},`,
            invited
              ? "Tap the button below to confirm your email. Then you're straight in to the family gallery."
              : "Tap the button below to confirm your email. A family admin will then review your request.",
          ],
          { label: "Confirm email", url },
          "The link works for 24 hours. Ignore this email if you didn't sign up.",
        );
  },
  /** The 6-digit code for joining through an invite link. The code leads the subject so it shows in notifications. */
  code(locale: Locale, name: string, code: string, minutes: number) {
    const email =
      locale === "id"
        ? render(
            "Kode untuk galeri keluarga",
            [
              name ? `Halo ${name},` : "Halo,",
              "Masukkan kode ini di halaman undangan untuk menyelesaikan pendaftaran. Setelah itu semua kenangan keluarga bisa langsung Anda lihat.",
            ],
            undefined,
            `Kode berlaku ${minutes} menit. Abaikan email ini jika Anda tidak sedang mendaftar.`,
            code,
          )
        : render(
            "Your family gallery code",
            [name ? `Hi ${name},` : "Hi,", "Enter this code on the invite page to finish joining. Then all the family's memories are there for you."],
            undefined,
            `The code works for ${minutes} minutes. Ignore this email if you aren't signing up.`,
            code,
          );
    return { ...email, subject: locale === "id" ? `${code} adalah kode Gallery of Ours Anda` : `${code} is your Gallery of Ours code` };
  },
  reset(locale: Locale, name: string, url: string) {
    return locale === "id"
      ? render(
          "Atur ulang kata sandi",
          [`Halo ${name},`, "Kami menerima permintaan untuk mengatur ulang kata sandi Anda."],
          { label: "Buat kata sandi baru", url },
          "Tautan berlaku 1 jam. Abaikan email ini jika bukan Anda yang meminta.",
        )
      : render(
          "Reset your password",
          [`Hi ${name},`, "We received a request to reset your password."],
          { label: "Set a new password", url },
          "The link works for 1 hour. Ignore this email if you didn't ask for it.",
        );
  },
  approved(locale: Locale, name: string, url: string) {
    return locale === "id"
      ? render(
          "Selamat datang di Gallery of Ours",
          [`Halo ${name},`, "Admin keluarga sudah menyetujui akun Anda. Semua kenangan keluarga sekarang bisa Anda lihat."],
          { label: "Buka galeri", url },
        )
      : render(
          "Welcome to Gallery of Ours",
          [`Hi ${name},`, "A family admin approved your account. All the family's memories are waiting for you."],
          { label: "Open the gallery", url },
        );
  },
};
