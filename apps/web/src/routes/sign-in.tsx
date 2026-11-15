import { createFileRoute, redirect } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
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

export const Route = createFileRoute("/sign-in")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: ({ context, search }) => {
    if (context.token) {
      throw redirect({ href: safeRedirectPath(search.redirect) });
    }
  },
  component: SignIn,
});

type Mode = "sign-in" | "sign-up";

function signInError(error: { code?: string; message?: string }) {
  if (error.code === "SIGNUPS_CLOSED") {
    return "Sign-ups are closed.";
  }
  return error.message ?? "Something went wrong. Try again.";
}

function SignIn() {
  const { redirect: redirectTo } = Route.useSearch();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setPending(true);
    setError(undefined);
    const result =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({
            email,
            password,
            name: email.split("@")[0] ?? email,
          });
    if (result.error) {
      setPending(false);
      setError(signInError(result.error));
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
            {mode === "sign-in"
              ? "Sign in to your bookmarks."
              : "Create your account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" method="post" onSubmit={submit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                autoComplete="email"
                id="email"
                name="email"
                required
                type="email"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                id="password"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </div>
            <p className="text-destructive min-h-5 text-sm" role="alert">
              {error}
            </p>
            <Button disabled={pending} type="submit">
              {mode === "sign-in" ? "Sign in" : "Create account"}
            </Button>
            <Button
              onClick={() =>
                setMode(mode === "sign-in" ? "sign-up" : "sign-in")
              }
              type="button"
              variant="link"
            >
              {mode === "sign-in"
                ? "New here? Create an account"
                : "Have an account? Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
