import { v } from "convex/values";
import { userMutation, userQuery } from "./functions";
import { listChanges, undoChange } from "./model/changes";

// Changes agents made in bulk, for Settings to show with Undo.
export const list = userQuery({
  args: { limit: v.optional(v.number()) },
  handler: listChanges,
});

export const undo = userMutation({
  args: { changeId: v.id("changes") },
  handler: undoChange,
});
