import { api } from "@schnellbuch/backend/api";
import { findDuplicateGroups } from "@schnellbuch/backend/duplicates";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CopyXIcon, LinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Favicon } from "@/components/favicon";
import { Toolbar } from "@/components/toolbar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { errorMessage } from "@/lib/errors";
import { type BookmarkEntry, useLibrary } from "@/lib/library";
import { useLibraryEdits } from "@/lib/library-edits";
import { useOffline, useOnlineMutation } from "@/lib/offline";
import { displayHost } from "@/lib/views";

export const Route = createFileRoute("/_app/health")({ component: Health });

const CHECKED = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

function Health() {
  return (
    <>
      <Toolbar>
        <h1 className="truncate px-1.5 font-semibold">Library health</h1>
      </Toolbar>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6">
        <BrokenLinks />
        <Duplicates />
      </div>
    </>
  );
}

function BrokenLinks() {
  const { bookmarks } = useLibrary();
  const edits = useLibraryEdits();
  const offline = useOffline();
  const check = useOnlineMutation(api.links.check);
  const checked = bookmarks.filter((bookmark) => bookmark.linkCheck);
  const gone = checked.filter(
    (bookmark) => bookmark.linkCheck?.status === "gone"
  );
  const unsure = checked.filter(
    (bookmark) => bookmark.linkCheck?.status === "unsure"
  );

  async function startCheck() {
    try {
      const { queued } = await check({});
      toast(
        queued === 0
          ? "Nothing to check right now. Each link is checked at most once an hour."
          : `Checking ${queued} links in the background. Results appear here.`
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon aria-hidden className="size-4" />
          Broken links
        </CardTitle>
        <CardDescription>
          SchnellBuch can check whether your saved pages still exist, the least
          recently checked first. Links an agent saved are never opened.{" "}
          {checked.length === 0
            ? "Nothing has been checked yet."
            : `${checked.length} of ${bookmarks.length} checked so far.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Button disabled={offline} onClick={startCheck} variant="outline">
            Check links
          </Button>
          {gone.length > 1 ? (
            <Button
              onClick={() =>
                edits.deleteItems(
                  gone.map((bookmark) => ({ kind: "bookmark", bookmark }))
                )
              }
              variant="destructive"
            >
              Delete all {gone.length} gone
            </Button>
          ) : null}
        </div>
        <LinkResults broken={[...gone, ...unsure]} checked={checked.length} />
      </CardContent>
    </Card>
  );
}

function LinkResults({
  broken,
  checked,
}: {
  broken: BookmarkEntry[];
  checked: number;
}) {
  if (broken.length > 0) {
    return (
      <ul className="flex flex-col divide-y rounded-lg border">
        {broken.map((bookmark) => (
          <BookmarkRow
            bookmark={bookmark}
            detail={linkStatus(bookmark)}
            key={bookmark._id}
          />
        ))}
      </ul>
    );
  }
  return checked > 0 ? (
    <p className="text-muted-foreground text-sm">
      Every checked link still works.
    </p>
  ) : null;
}

function Duplicates() {
  const { bookmarks, flatFolders } = useLibrary();
  const edits = useLibraryEdits();
  const groups = findDuplicateGroups(bookmarks);
  const pathById = new Map(
    flatFolders.map((folder) => [folder._id, folder.path])
  );
  const where = (bookmark: BookmarkEntry) =>
    (bookmark.folderId && pathById.get(bookmark.folderId)) || "Bookmarks";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CopyXIcon aria-hidden className="size-4" />
          Duplicates
        </CardTitle>
        <CardDescription>
          Bookmarks that open the same page, even under different links (http or
          https, www, tracking parameters, a trailing slash).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {groups.length === 0 ? (
          <p className="text-muted-foreground text-sm">No duplicates.</p>
        ) : (
          groups.map((group) => {
            const [newest, ...older] = group.bookmarks;
            return (
              <div className="flex flex-col gap-2" key={group.key}>
                <ul className="flex flex-col divide-y rounded-lg border">
                  {group.bookmarks.map((bookmark) => (
                    <BookmarkRow
                      bookmark={bookmark}
                      detail={`${where(bookmark)} · ${bookmark.url}`}
                      key={bookmark._id}
                    />
                  ))}
                </ul>
                {newest ? (
                  <div>
                    <Button
                      onClick={() =>
                        edits.deleteItems(
                          older.map((bookmark) => ({
                            kind: "bookmark",
                            bookmark,
                          }))
                        )
                      }
                      size="sm"
                      variant="outline"
                    >
                      Keep the newest, delete {older.length}
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function BookmarkRow({
  bookmark,
  detail,
}: {
  bookmark: BookmarkEntry;
  detail: ReactNode;
}) {
  const edits = useLibraryEdits();
  const navigate = useNavigate();
  return (
    <li className="flex items-center gap-3 p-3 text-sm">
      <Favicon src={bookmark.faviconUrl} />
      <span className="min-w-0 flex-1">
        <a
          className="block truncate font-medium hover:underline"
          href={bookmark.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {bookmark.title}
        </a>
        <span className="text-muted-foreground block truncate text-xs">
          {detail}
        </span>
      </span>
      <Button
        onClick={() =>
          navigate({
            to: "/",
            search: { folder: bookmark.folderId, select: bookmark._id },
          })
        }
        size="sm"
        variant="ghost"
      >
        Show
      </Button>
      <Button
        onClick={() => edits.deleteBookmark(bookmark)}
        size="sm"
        variant="outline"
      >
        Delete
      </Button>
    </li>
  );
}

function linkStatus(bookmark: BookmarkEntry) {
  const check = bookmark.linkCheck;
  if (!check) {
    return displayHost(bookmark.url);
  }
  const when = CHECKED.format(check.checkedAt);
  if (check.status === "gone") {
    return `Gone${check.httpStatus ? ` (${check.httpStatus})` : ""} · checked ${when}`;
  }
  return `Didn't answer properly${check.httpStatus ? ` (${check.httpStatus})` : ""}; may still work · checked ${when}`;
}
