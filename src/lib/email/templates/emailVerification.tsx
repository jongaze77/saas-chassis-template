/* eslint-disable @next/next/no-head-element -- Email template, not a Next.js page */

interface EmailVerificationProps {
  verificationUrl: string;
  name: string;
}

export function EmailVerification({ verificationUrl, name }: EmailVerificationProps) {
  return (
    <html lang="en">
      <head>
        <title>Verify your email address</title>
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
                  Verify your email address
                </h1>
                <p>Hi {name || "there"},</p>
                <p>
                  Thanks for signing up for SEO PluginPress. Please verify your email
                  address by clicking the link below:
                </p>
                <p>
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
                    Verify Email Address
                  </a>
                </p>
                <p style={{ fontSize: "14px", color: "#666666" }}>
                  This link will expire in 24 hours.
                </p>
                <p style={{ fontSize: "14px", color: "#666666" }}>
                  If you didn&apos;t create an account, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}
