import { useRouteContext } from "@tanstack/react-router";
import { UserRoundIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
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

const MIN_PASSWORD_LENGTH = 8;

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
          Change your password, or delete your account and everything in it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ChangePassword disabled={offline} />
        <DeleteAccount disabled={offline} />
      </CardContent>
    </Card>
  );
}

function ChangePassword({ disabled }: { disabled: boolean }) {
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    setPending(true);
    const { error } = await authClient.changePassword({
      currentPassword: String(fields.get("current-password")),
      newPassword: String(fields.get("new-password")),
      revokeOtherSessions: true,
    });
    setPending(false);
    if (error) {
      toast.error(error.message ?? "Your password didn't change. Try again.");
      return;
    }
    form.reset();
    toast.success("Password changed. Your other devices are signed out.");
  }

  return (
    <form className="flex flex-col gap-3" method="post" onSubmit={submit}>
      <span className="text-sm font-medium">Change password</span>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            autoComplete="current-password"
            id="current-password"
            name="current-password"
            required
            type="password"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            autoComplete="new-password"
            id="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            name="new-password"
            required
            type="password"
          />
        </div>
      </div>
      <div>
        <Button disabled={disabled || pending} type="submit" variant="outline">
          Change password
        </Button>
      </div>
    </form>
  );
}

function DeleteAccount({ disabled }: { disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const { token } = useRouteContext({ from: "__root__" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    setPending(true);
    const { error } = await authClient.deleteUser({ password });
    if (error) {
      setPending(false);
      toast.error(error.message ?? "Your account wasn't deleted. Try again.");
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
          onClick={() => setOpen(true)}
          variant="destructive"
        >
          Delete account…
        </Button>
      </div>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <form className="flex flex-col gap-4" method="post" onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                Your bookmarks, folders, history and agent connections are
                deleted for good. This can't be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="delete-password">Your password</Label>
              <Input
                autoComplete="current-password"
                autoFocus
                id="delete-password"
                name="password"
                required
                type="password"
              />
            </div>
            <DialogFooter>
              <Button
                onClick={() => setOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={pending} type="submit" variant="destructive">
                Delete account
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
