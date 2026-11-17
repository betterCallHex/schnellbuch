import { useRouteContext } from "@tanstack/react-router";
import { UserRoundIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { leaveDevice } from "@/lib/leave-device";
import { tokenSubject } from "@/lib/mirror";
import { useOffline } from "@/lib/offline";
import { CODE_LENGTH, signInCodeError } from "@/lib/sign-in-code";

export function AccountSettings() {
  const offline = useOffline();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRoundIcon aria-hidden className="size-4" />
          Account
        </CardTitle>
        <CardDescription>
          Delete your account and everything in it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <DeleteAccount disabled={offline} />
      </CardContent>
    </Card>
  );
}

function DeleteAccount({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const { token } = useRouteContext({ from: "__root__" });
  const email = authClient.useSession().data?.user.email;

  function openDialog(next: boolean) {
    setOpen(next);
    setCodeSent(false);
    setError(undefined);
  }

  async function sendCode() {
    if (!email) {
      return;
    }
    setPending(true);
    setError(undefined);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setPending(false);
    if (sendError) {
      setError(signInCodeError(sendError));
      return;
    }
    setCodeSent(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) {
      return;
    }
    if (!codeSent) {
      await sendCode();
      return;
    }
    const otp = String(new FormData(event.currentTarget).get("code")).trim();
    setPending(true);
    setError(undefined);
    const confirmed = await authClient.signIn.emailOtp({ email, otp });
    if (confirmed.error) {
      setPending(false);
      setError(signInCodeError(confirmed.error));
      return;
    }
    const { error: deleteError } = await authClient.deleteUser();
    if (deleteError) {
      setPending(false);
      setError(
        deleteError.message ?? "Your account wasn't deleted. Try again."
      );
      return;
    }
    await leaveDevice(tokenSubject(token), () => Promise.resolve());
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium">Delete account</span>
      <p className="text-muted-foreground text-sm">
        Deletes your bookmarks, folders and agent connections for good. Export
        your bookmarks first if you want to keep them.
      </p>
      <div>
        <Button
          disabled={disabled}
          onClick={() => openDialog(true)}
          variant="destructive"
        >
          Delete account…
        </Button>
      </div>
      <Dialog onOpenChange={openDialog} open={open}>
        <DialogContent>
          <form className="flex flex-col gap-4" method="post" onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                Your bookmarks, folders, history and agent connections are
                deleted for good. This can't be undone.
                {codeSent
                  ? ` Enter the code we emailed to ${email}.`
                  : " To confirm, we'll email you a code."}
              </DialogDescription>
            </DialogHeader>
            {codeSent ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="delete-code">Code</Label>
                <Input
                  autoComplete="one-time-code"
                  autoFocus
                  className="font-mono tracking-[0.3em]"
                  id="delete-code"
                  inputMode="numeric"
                  maxLength={CODE_LENGTH}
                  minLength={CODE_LENGTH}
                  name="code"
                  pattern="[0-9]*"
                  required
                />
              </div>
            ) : null}
            <p className="text-destructive min-h-5 text-sm" role="alert">
              {error}
            </p>
            <DialogFooter>
              <Button
                onClick={() => openDialog(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={pending || !email}
                type="submit"
                variant="destructive"
              >
                {codeSent ? "Delete account" : "Email me a code"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
