/* eslint-disable @next/next/no-head-element -- Email template, not a Next.js page */

interface EmailChangeProps {
  verificationUrl: string;
  name: string;
  newEmail: string;
}

export function EmailChange({ verificationUrl, name, newEmail }: EmailChangeProps) {
  return (
    <html lang="en">
      <head>
        <title>Confirm your new email address</title>
      </head>
      <body
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          lineHeight: "1.6",
          color: "#333333",
          maxWidth: "600px",
          margin: "0 auto",
          padding: "20px",
        }}
      >
        <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
          <tbody>
            <tr>
              <td>
                <h1 style={{ fontSize: "24px", marginBottom: "16px" }}>
                  Confirm your new email address
                </h1>
                <p>Hi {name || "there"},</p>
                <p>
                  You requested to change your email address to{" "}
                  <strong>{newEmail}</strong>. Click the button below to confirm
                  this change:
                </p>
                <p>
                  {/* TECH DEBT: Button color is hardcoded to Tailwind slate-900 (#0f172a).
                      Email clients don't support CSS variables or design tokens, so
                      inline styles are required. If brand colors change, update all
                      email templates (emailVerification, passwordReset, emailChange). */}
                  <a
                    href={verificationUrl}
                    style={{
                      display: "inline-block",
                      padding: "12px 24px",
                      backgroundColor: "#0f172a",
                      color: "#ffffff",
                      textDecoration: "none",
                      borderRadius: "6px",
                      fontWeight: "bold",
                    }}
                  >
                    Confirm Email Change
                  </a>
                </p>
                <p style={{ fontSize: "14px", color: "#666666" }}>
                  This link will expire in 1 hour.
                </p>
                <p style={{ fontSize: "14px", color: "#666666" }}>
                  If you didn&apos;t request this change, you can safely ignore
                  this email. Your email address will remain unchanged.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
