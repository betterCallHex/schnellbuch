import { createFileRoute, redirect } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { safeRedirectPath } from "@/lib/redirect";
import { optionalText } from "@/lib/search-params";
import { CODE_LENGTH, signInCodeError } from "@/lib/sign-in-code";

export const Route = createFileRoute("/sign-in")({
  validateSearch: z.object({ redirect: optionalText }),
  beforeLoad: ({ context, search }) => {
    if (context.token) {
      throw redirect({ href: safeRedirectPath(search.redirect) });
    }
  },
  component: SignIn,
});

function SignIn() {
  const { redirect: redirectTo } = Route.useSearch();
  const [email, setEmail] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function sendCode(address: string) {
    setPending(true);
    setError(undefined);
    const result = await authClient.emailOtp.sendVerificationOtp({
      email: address,
      type: "sign-in",
    });
    setPending(false);
    if (result.error) {
      setError(signInCodeError(result.error));
      return;
    }
    setEmail(address);
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendCode(String(new FormData(event.currentTarget).get("email")));
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) {
      return;
    }
    setPending(true);
    setError(undefined);
    const result = await authClient.signIn.emailOtp({
      email,
      otp: String(new FormData(event.currentTarget).get("code")).trim(),
      name: email.split("@")[0] ?? email,
    });
    if (result.error) {
      setPending(false);
      setError(signInCodeError(result.error));
      return;
    }
    window.location.assign(safeRedirectPath(redirectTo));
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>SchnellBuch</CardTitle>
          <CardDescription>
            {email
              ? `We emailed a ${CODE_LENGTH}-digit code to ${email}.`
              : "Sign in or create an account with your email."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {email ? (
            <form
              className="flex flex-col gap-4"
              key="code"
              method="post"
              onSubmit={submitCode}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  autoComplete="one-time-code"
                  autoFocus
                  className="font-mono tracking-[0.3em]"
                  id="code"
                  inputMode="numeric"
                  maxLength={CODE_LENGTH}
                  minLength={CODE_LENGTH}
                  name="code"
                  pattern="[0-9]*"
                  required
                />
              </div>
              <p className="text-destructive min-h-5 text-sm" role="alert">
                {error}
              </p>
              <Button disabled={pending} type="submit">
                Sign in
              </Button>
              <div className="flex justify-between">
                <Button
                  disabled={pending}
                  onClick={() => {
                    setEmail(undefined);
                    setError(undefined);
                  }}
                  type="button"
                  variant="link"
                >
                  Use another email
                </Button>
                <Button
                  disabled={pending}
                  onClick={() => sendCode(email)}
                  type="button"
                  variant="link"
                >
                  Send a new code
                </Button>
              </div>
            </form>
          ) : (
            <form
              className="flex flex-col gap-4"
              key="email"
              method="post"
              onSubmit={submitEmail}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  autoComplete="email"
                  autoFocus
                  id="email"
                  name="email"
                  required
                  type="email"
                />
              </div>
              <p className="text-destructive min-h-5 text-sm" role="alert">
                {error}
              </p>
              <Button disabled={pending} type="submit">
                Email me a code
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
