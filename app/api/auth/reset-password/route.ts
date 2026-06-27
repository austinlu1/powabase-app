/**
 * POST /api/auth/reset-password
 * Body: { email }
 * Generates a reset link via Powabase GoTrue admin API, then sends it
 * via Resend since Powabase's built-in mailer is not configured.
 * Always returns 200 to avoid leaking whether an email exists.
 */
import { NextRequest, NextResponse } from "next/server";
import { POWABASE_URL } from "@/lib/powabase-server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    // Ask GoTrue to generate a recovery link (does not send email itself)
    const res = await fetch(`${POWABASE_URL}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        apikey: process.env.POWABASE_KEY!,
        Authorization: `Bearer ${process.env.POWABASE_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "recovery",
        email,
        options: { redirect_to: `${appUrl}/reset-password` },
      }),
    });

    // If user doesn't exist, still return 200 (don't leak email existence)
    if (!res.ok) {
      return NextResponse.json({ success: true });
    }

    const data = await res.json();
    const resetLink = data.action_link;

    if (!resetLink) {
      return NextResponse.json({ success: true });
    }

    // Send the email via Resend
    await resend.emails.send({
      from: "Powabase Chat <onboarding@resend.dev>",
      to: email,
      subject: "Reset your password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
          <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Reset your password</h2>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">
            Click the button below to set a new password for your Powabase Chat account.
            This link expires in 1 hour.
          </p>
          <a href="${resetLink}" style="display: inline-block; background: #2563eb; color: white; font-size: 14px; font-weight: 600; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
            Reset Password
          </a>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    console.error("Reset password error:", e);
    return NextResponse.json({ success: true }); // always 200
  }
}
