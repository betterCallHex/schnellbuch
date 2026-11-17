const MAILTRAP_SEND_URL = "https://send.api.mailtrap.io/api/send";

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

export async function sendWithMailtrap(
  email: Email,
  { token, from }: { token: string; from: string }
) {
  const response = await fetch(MAILTRAP_SEND_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: { email: from, name: "SchnellBuch" },
      to: [{ email: email.to }],
      subject: email.subject,
      text: email.text,
      category: "Sign-in code",
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Mailtrap refused the email: ${response.status} ${await response.text()}`
    );
  }
}
