import { clearOfflineData } from "@/lib/offline";
import { discardQueue } from "@/lib/offline-queue-store";

// Removes the library this device kept for offline use, ends the session
// with `end` and goes to the sign-in page.
export async function leaveDevice(
  userId: string | undefined,
  end: () => Promise<unknown>
) {
  if (userId) {
    await Promise.all([clearOfflineData(userId), discardQueue(userId)]);
  }
  await end();
  window.location.assign("/sign-in");
}
