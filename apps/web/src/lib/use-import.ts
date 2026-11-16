import { api } from "@schnellbuch/backend/api";

import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import { importSummary } from "@/lib/import-summary";
import { useOnlineAction } from "@/lib/offline";

// Opens a file picker for a browser's bookmarks export and imports it. The
// import keeps running on the server if the page is closed; Settings shows
// its progress.
export function useImportBookmarks() {
  const start = useOnlineAction(api.imports.start);
  return () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".html,.htm,text/html";
    // Attached (hidden) while the picker is open: some browsers ignore a
    // click on a detached file input.
    input.hidden = true;
    document.body.append(input);
    input.addEventListener("cancel", () => input.remove());
    input.addEventListener("change", async () => {
      input.remove();
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      const toastId = toast.loading(`Importing ${file.name}…`);
      try {
        const result = await start({
          fileName: file.name,
          html: await file.text(),
        });
        toast.success(result ? importSummary(result) : "Import finished.", {
          id: toastId,
        });
      } catch (error) {
        toast.error(errorMessage(error), { id: toastId });
      }
    });
    input.click();
  };
}
