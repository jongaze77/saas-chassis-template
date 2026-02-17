/* eslint-disable @next/next/no-head-element -- Email template, not a Next.js page */

interface PasswordResetProps {
  resetUrl: string;
  name: string;
}

export function PasswordReset({ resetUrl, name }: PasswordResetProps) {
  return (
    <html lang="en">
      <head>
        <title>Reset your password</title>
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
                  Reset your password
                </h1>
                <p>Hi {name || "there"},</p>
                <p>
                  We received a request to reset the password for your SEO PluginPress
                  account. Click the link below to set a new password:
                </p>
                <p>
                  <a
                    href={resetUrl}
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
                    Reset Password
                  </a>
                </p>
                <p style={{ fontSize: "14px", color: "#666666" }}>
                  This link will expire in 24 hours.
                </p>
                <p style={{ fontSize: "14px", color: "#666666" }}>
                  If you didn&apos;t request a password reset, you can safely ignore
                  this email. Your password will remain unchanged.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
