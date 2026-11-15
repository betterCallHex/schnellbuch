import { userMutation, userQuery } from "./functions";
import {
  addBookmark,
  addBookmarkArgs,
  deleteBookmark,
  deleteBookmarkArgs,
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
