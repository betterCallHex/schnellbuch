import { ConvexError } from "convex/values";
import { toast } from "sonner";

export async function succeeded(work: Promise<unknown>) {
  try {
    await work;
    return true;
  } catch (error) {
    toast.error(errorMessage(error));
    return false;
  }
}

export function errorMessage(error: unknown) {
  if (error instanceof ConvexError && typeof error.data === "string") {
    return error.data;
  }
  return "Something went wrong. Try again.";
}
