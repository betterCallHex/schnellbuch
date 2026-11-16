import type { Id } from "@schnellbuch/backend/data-model";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { useNavigate, useSearch } from "@tanstack/react-router";

import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { CustomizeFolderForm } from "@/components/customize-folder";
import { FolderSelect, TOP_LEVEL } from "@/components/folder-select";
import { Button } from "@/components/ui/button";
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
import {
  type BookmarkEntry,
  type FolderEntry,
  useLibrary,
} from "@/lib/library";
import { useLibraryEdits } from "@/lib/library-edits";

type DialogRequest =
  | { kind: "add-bookmark"; folderId?: Id<"folders"> }
  | { kind: "edit-bookmark"; bookmark: BookmarkEntry }
  | { kind: "new-folder"; parentId?: Id<"folders"> }
  | { kind: "rename-folder"; folder: FolderEntry }
  | { kind: "customize-folder"; folder: FolderEntry }
  | { kind: "delete-folder"; folder: FolderEntry };

const OpenDialogContext = createContext<(request: DialogRequest) => void>(
  () => undefined
);

export function useOpenDialog() {
  return useContext(OpenDialogContext);
}

export function AppDialogsProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const close = () => setRequest(null);
  return (
    <OpenDialogContext value={setRequest}>
      {children}
      <Dialog onOpenChange={(open) => open || close()} open={request !== null}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto">
          {request ? (
            <HotkeysProvider exclusive scope="dialog">
              <ActiveDialog onDone={close} request={request} />
            </HotkeysProvider>
          ) : null}
        </DialogContent>
      </Dialog>
    </OpenDialogContext>
  );
}

function ActiveDialog({
  request,
  onDone,
}: {
  request: DialogRequest;
  onDone: () => void;
}) {
  switch (request.kind) {
    case "add-bookmark":
      return (
        <BookmarkForm initialFolderId={request.folderId} onDone={onDone} />
      );
    case "edit-bookmark":
      return <BookmarkForm bookmark={request.bookmark} onDone={onDone} />;
    case "new-folder":
      return <FolderNameForm onDone={onDone} parentId={request.parentId} />;
    case "rename-folder":
      return <FolderNameForm folder={request.folder} onDone={onDone} />;
    case "customize-folder":
      return <CustomizeFolderForm folder={request.folder} onDone={onDone} />;
    case "delete-folder":
      return <DeleteFolderConfirm folder={request.folder} onDone={onDone} />;
    default:
      return request satisfies never;
  }
}

function BookmarkForm({
  bookmark,
  initialFolderId,
  onDone,
}: {
  bookmark?: BookmarkEntry;
  initialFolderId?: Id<"folders">;
  onDone: () => void;
}) {
  const { flatFolders } = useLibrary();
  const edits = useLibraryEdits();
  const [folder, setFolder] = useState<string>(
    bookmark?.folderId ?? initialFolderId ?? TOP_LEVEL
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const url = String(form.get("url"));
    const title = String(form.get("title")).trim();
    const folderId = folder === TOP_LEVEL ? null : (folder as Id<"folders">);
    if (bookmark) {
      onDone();
      await edits.editBookmark(bookmark, { url, title, folderId });
      return;
    }
    if (
      await edits.addBookmark({
        url,
        title: title || undefined,
        folderId: folderId ?? undefined,
      })
    ) {
      onDone();
    }
  }

  return (
    <form className="flex flex-col gap-4" method="post" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>{bookmark ? "Edit bookmark" : "Add bookmark"}</DialogTitle>
        <DialogDescription>
          {bookmark
            ? "Change the link, its title or its folder."
            : "Leave the title empty to use the page's own title."}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="bookmark-url">Link</Label>
        <Input
          autoFocus
          defaultValue={bookmark?.url}
          id="bookmark-url"
          name="url"
          placeholder="example.com"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="bookmark-title">Title</Label>
        <Input
          defaultValue={bookmark?.title}
          id="bookmark-title"
          name="title"
          required={Boolean(bookmark)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="bookmark-folder">Folder</Label>
        <FolderSelect
          folders={flatFolders}
          id="bookmark-folder"
          onChange={setFolder}
          value={folder}
        />
      </div>
      <DialogFooter>
        <Button type="submit">{bookmark ? "Save" : "Add bookmark"}</Button>
      </DialogFooter>
    </form>
  );
}

function FolderNameForm({
  folder,
  parentId,
  onDone,
}: {
  folder?: FolderEntry;
  parentId?: Id<"folders">;
  onDone: () => void;
}) {
  const edits = useLibraryEdits();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name"));
    onDone();
    await (folder
      ? edits.renameFolder(folder, name)
      : edits.createFolder({ name, parentId }));
  }

  return (
    <form className="flex flex-col gap-4" method="post" onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>{folder ? "Rename folder" : "New folder"}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="folder-name">Name</Label>
        <Input
          autoFocus
          defaultValue={folder?.name}
          id="folder-name"
          name="name"
          required
        />
      </div>
      <DialogFooter>
        <Button type="submit">{folder ? "Rename" : "Create folder"}</Button>
      </DialogFooter>
    </form>
  );
}

function DeleteFolderConfirm({
  folder,
  onDone,
}: {
  folder: FolderEntry;
  onDone: () => void;
}) {
  const edits = useLibraryEdits();
  const { flatFolders, bookmarks } = useLibrary();
  const navigate = useNavigate();
  const { folder: activeFolder } = useSearch({ strict: false });
  const parentName = flatFolders.find(
    (candidate) => candidate._id === folder.parentId
  )?.name;

  async function confirm() {
    onDone();
    if (activeFolder === folder._id) {
      await navigate({
        to: "/",
        search: { folder: folder.parentId },
      });
    }
    await edits.deleteFolder(
      folder,
      bookmarks
        .filter((bookmark) => bookmark.folderId === folder._id)
        .map((bookmark) => bookmark._id)
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Delete “{folder.name}”?</DialogTitle>
        <DialogDescription>
          Its bookmarks and subfolders move to{" "}
          {parentName ? `“${parentName}”` : "the top level"}. Nothing else is
          deleted.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button onClick={onDone} type="button" variant="outline">
          Cancel
        </Button>
        <Button onClick={confirm} type="button" variant="destructive">
          Delete folder
        </Button>
      </DialogFooter>
    </>
  );
}
