import { api } from "@schnellbuch/backend/api";
import { useConvex } from "convex/react";
import { toast } from "sonner";
import { downloadTextFile, exportFileName } from "@/lib/backup";
import { errorMessage } from "@/lib/errors";

export function useExportLibrary() {
  const convex = useConvex();
  return async () => {
    try {
      const html = await convex.query(api.bookmarks.exportFile, {});
      downloadTextFile(exportFileName(new Date()), html, "text/html");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
}
