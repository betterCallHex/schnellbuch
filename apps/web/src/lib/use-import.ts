import { api } from "@schnellbuch/backend/api";

import { toast } from "sonner";
import type { BrowserName } from "@/lib/browsers";
import { errorMessage } from "@/lib/errors";
import { importSummary } from "@/lib/import-summary";
import { useOnlineAction } from "@/lib/offline";

export interface BookmarksImport {
  fileName: string;
  label: string;
  readHtml: () => Promise<string>;
  source?: BrowserName;
}

export function useImportBookmarks() {
  const start = useOnlineAction(api.imports.start);
  return async ({ fileName, label, readHtml, source }: BookmarksImport) => {
    const toastId = toast.loading(`Importing ${label}…`);
    try {
      const result = await start({
        fileName,
        source,
        html: await readHtml(),
      });
      toast.success(result ? importSummary(result) : "Import finished.", {
        id: toastId,
      });
    } catch (error) {
      toast.error(errorMessage(error), { id: toastId });
    }
  };
}
