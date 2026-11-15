const PAD = 2;

// schnellbuch-YYYY-MM-DD.html in the user's own time zone, so backups sort
// by date.
export function exportFileName(date: Date) {
  const day = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(PAD, "0"),
    String(date.getDate()).padStart(PAD, "0"),
  ].join("-");
  return `schnellbuch-${day}.html`;
}

export function downloadTextFile(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
