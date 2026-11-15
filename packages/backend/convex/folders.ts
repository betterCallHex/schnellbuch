import {
  agentMutation,
  agentQuery,
  userMutation,
  userQuery,
} from "./functions";
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

export const listForAgent = agentQuery({ args: {}, handler: listFolders });
export const createForAgent = agentMutation({
  args: createFolderArgs,
  handler: createFolder,
});
export const updateForAgent = agentMutation({
  args: updateFolderArgs,
  handler: updateFolder,
});
export const removeForAgent = agentMutation({
  args: deleteFolderArgs,
  handler: deleteFolder,
});
