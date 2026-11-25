const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

export interface Email {
  subject: string;
  text: string;
  to: string;
}

export function signInCodeEmail(to: string, code: string): Email {
  return {
    to,
    subject: `${code} is your SchnellBuch sign-in code`,
    text: `Your SchnellBuch sign-in code is ${code}.\n\nIt works once, for the next 5 minutes. If you didn't ask for it, ignore this email: nobody can sign in without the code.`,
  };
}

export async function sendWithBrevo(
  email: Email,
  { apiKey, from }: { apiKey: string; from: string }
) {
  const response = await fetch(BREVO_SEND_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: from, name: "SchnellBuch" },
      to: [{ email: email.to }],
      subject: email.subject,
      textContent: email.text,
      tags: ["Sign-in code"],
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Brevo refused the email: ${response.status} ${await response.text()}`
    );
  }
}
