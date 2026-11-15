import { userMutation, userQuery } from "./functions";
import {
  createFolder,
  createFolderArgs,
  deleteFolder,
  deleteFolderArgs,
  listFolders,
  updateFolder,
  updateFolderArgs,
} from "./model/folders";

export const list = userQuery({ args: {}, handler: listFolders });
export const create = userMutation({
  args: createFolderArgs,
  handler: createFolder,
});
export const update = userMutation({
  args: updateFolderArgs,
  handler: updateFolder,
});
export const remove = userMutation({
  args: deleteFolderArgs,
  handler: deleteFolder,
});
