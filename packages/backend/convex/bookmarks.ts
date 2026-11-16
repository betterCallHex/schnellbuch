import { userMutation, userQuery } from "./functions";
import { exportLibrary } from "./model/backup";
import {
  addBookmark,
  addBookmarkArgs,
  deleteBookmark,
  deleteBookmarkArgs,
  duplicateBookmark,
  duplicateBookmarkArgs,
  listBookmarks,
  updateBookmark,
  updateBookmarkArgs,
} from "./model/bookmarks";

export const list = userQuery({ args: {}, handler: listBookmarks });
export const add = userMutation({
  args: addBookmarkArgs,
  handler: addBookmark,
});
export const update = userMutation({
  args: updateBookmarkArgs,
  handler: updateBookmark,
});
export const remove = userMutation({
  args: deleteBookmarkArgs,
  handler: deleteBookmark,
});
export const duplicate = userMutation({
  args: duplicateBookmarkArgs,
  handler: duplicateBookmark,
});

// The whole library as a browser bookmarks file (Netscape HTML).
export const exportFile = userQuery({ args: {}, handler: exportLibrary });
