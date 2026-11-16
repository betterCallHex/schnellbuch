import { browser } from "wxt/browser";
import { normalizeServerUrl } from "@/lib/add-url";
import { serverUrl } from "@/lib/settings";

const form = document.querySelector<HTMLFormElement>("#settings");
const input = document.querySelector<HTMLInputElement>("#server");
const status = document.querySelector<HTMLElement>("#status");
const shortcut = document.querySelector<HTMLElement>("#shortcut");

async function load() {
  if (input) {
    input.value = await serverUrl.getValue();
  }
  const [command] = (await browser.commands.getAll()).filter(
    (candidate) => candidate.name === "save-page"
  );
  if (shortcut && command?.shortcut) {
    shortcut.textContent = command.shortcut;
  }
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const cleaned = normalizeServerUrl(input?.value ?? "");
  if (!(status && input)) {
    return;
  }
  if (!cleaned) {
    status.dataset.error = "";
    status.textContent = "That isn't a web address.";
    return;
  }
  await serverUrl.setValue(cleaned);
  input.value = cleaned;
  delete status.dataset.error;
  status.textContent = "Saved";
});

load();
