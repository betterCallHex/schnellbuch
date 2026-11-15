import type { Id } from "@schnellbuch/backend/data-model";
import {
  useCanGoBack,
  useNavigate,
  useRouter,
  useSearch,
} from "@tanstack/react-router";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EllipsisIcon,
  FolderPlusIcon,
  LogOutIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useOpenDialog } from "@/components/app-dialogs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

export function Toolbar({ children }: { children: ReactNode }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return (
    <header className="bg-background/85 sticky top-0 z-20 flex items-center gap-2 border-b px-3 py-2 backdrop-blur-md md:gap-3 md:px-4">
      <div className="bg-muted/40 flex shrink-0 items-center rounded-full border p-0.5">
        <Button
          aria-label="Back"
          className="rounded-full"
          disabled={!canGoBack}
          onClick={() => router.history.back()}
          size="icon-sm"
          variant="ghost"
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          aria-label="Forward"
          className="rounded-full"
          onClick={() => router.history.forward()}
          size="icon-sm"
          variant="ghost"
        >
          <ChevronRightIcon />
        </Button>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
      <NewMenu />
      <Button
        aria-label="Search"
        className="rounded-full"
        onClick={openPalette}
        size="icon"
        variant="outline"
      >
        <SearchIcon />
      </Button>
      <MoreMenu />
    </header>
  );
}

function openPalette() {
  window.dispatchEvent(
    new KeyboardEvent("keydown", { key: "k", metaKey: true })
  );
}

function NewMenu() {
  const openDialog = useOpenDialog();
  const { folder } = useSearch({ strict: false });
  const folderId = folder as Id<"folders"> | undefined;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="New"
            className="rounded-full"
            size="icon"
            variant="outline"
          />
        }
      >
        <PlusIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onClick={() => openDialog({ kind: "add-bookmark", folderId })}
        >
          <PlusIcon />
          New bookmark
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => openDialog({ kind: "new-folder", parentId: folderId })}
        >
          <FolderPlusIcon />
          New folder
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          Paste a link to save it
          <DropdownMenuShortcut>⌘V</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoreMenu() {
  const navigate = useNavigate();

  async function signOut() {
    await authClient.signOut();
    window.location.assign("/sign-in");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="More"
            className="rounded-full"
            size="icon"
            variant="outline"
          />
        }
      >
        <EllipsisIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
          <SettingsIcon />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={signOut}>
          <LogOutIcon />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
