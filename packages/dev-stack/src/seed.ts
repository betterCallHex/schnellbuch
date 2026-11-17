import { api } from "@schnellbuch/backend/api";
import type { Id } from "@schnellbuch/backend/data-model";
import { ConvexHttpClient } from "convex/browser";
import { type Account, convexCli, type StackState, urls } from "./stack";

interface SampleFolder {
  bookmarks?: [url: string, title: string][];
  folders?: SampleFolder[];
  name: string;
}

// Two libraries with nested folders and top-level bookmarks, so a check can
// prove one account never sees the other's data.
const SAMPLES: Record<string, SampleFolder> = {
  "ada@schnellbuch.test": {
    name: "",
    bookmarks: [
      ["https://developer.mozilla.org/", "MDN Web Docs"],
      ["https://news.ycombinator.com/", "Hacker News"],
    ],
    folders: [
      {
        name: "Dev",
        folders: [
          {
            name: "Convex",
            bookmarks: [
              ["https://docs.convex.dev/", "Convex Developer Hub"],
              ["https://stack.convex.dev/", "Stack: the Convex blog"],
            ],
          },
          {
            name: "Tools",
            bookmarks: [
              ["https://bun.sh/", "Bun"],
              ["https://biomejs.dev/", "Biome"],
            ],
          },
        ],
      },
      {
        name: "Reading",
        bookmarks: [
          ["https://paulgraham.com/greatwork.html", "How to Do Great Work"],
          [
            "http://www.paulgraham.com/greatwork.html?utm_source=feed",
            "How to Do Great Work (feed)",
          ],
        ],
      },
    ],
  },
  "bob@schnellbuch.test": {
    name: "",
    bookmarks: [["https://www.bbc.co.uk/weather", "BBC Weather"]],
    folders: [
      {
        name: "Recipes",
        bookmarks: [["https://www.seriouseats.com/", "Serious Eats"]],
      },
      {
        name: "Travel",
        folders: [
          {
            name: "Japan",
            bookmarks: [["https://www.japan-guide.com/", "japan-guide.com"]],
          },
        ],
      },
    ],
  },
};

export async function seedAccounts(state: StackState) {
  for (const account of state.accounts) {
    // biome-ignore lint/performance/noAwaitInLoops: accounts are seeded one after the other to keep the output readable
    const { userId, token } = await signUpOrIn(state, account);
    account.userId = userId;
    if (!state.seeded) {
      const sample = SAMPLES[account.email];
      if (sample) {
        const client = new ConvexHttpClient(urls(state.ports).backend);
        client.setAuth(token);
        await addFolder(client, sample, undefined);
      }
    }
    account.apiKey ??= mintApiKey(state, userId);
  }
  state.seeded = true;
}

// A sign-in code issued by the backend directly, so no email is needed.
export function signInCode(state: StackState, email: string) {
  return JSON.parse(
    convexCli(state, ["run", "account:signInCode", JSON.stringify({ email })])
  ) as string;
}

// Through the web app's own /api/auth routes, as a browser would.
async function signUpOrIn(state: StackState, account: Account) {
  const { web } = urls(state.ports);
  const response = await fetch(`${web}/api/auth/sign-in/email-otp`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: web },
    body: JSON.stringify({
      email: account.email,
      otp: signInCode(state, account.email),
      name: account.email.split("@")[0],
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Couldn't sign in ${account.email}: ${response.status} ${await response.text()}`
    );
  }
  const { user } = (await response.json()) as { user: { id: string } };
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  const tokenResponse = await fetch(`${web}/api/auth/convex/token`, {
    headers: { cookie },
  });
  const { token } = (await tokenResponse.json()) as { token?: string };
  if (!token) {
    throw new Error(`No Convex token for ${account.email}.`);
  }
  return { userId: user.id, token };
}

async function addFolder(
  client: ConvexHttpClient,
  folder: SampleFolder,
  parentId: Id<"folders"> | undefined
) {
  for (const [url, title] of folder.bookmarks ?? []) {
    // biome-ignore lint/performance/noAwaitInLoops: keeps saved dates in a stable order
    await client.mutation(api.bookmarks.add, {
      url,
      title,
      folderId: parentId,
    });
  }
  for (const child of folder.folders ?? []) {
    // biome-ignore lint/performance/noAwaitInLoops: a folder is created before what goes inside it
    const childId = await client.mutation(api.folders.create, {
      name: child.name,
      parentId,
    });
    await addFolder(client, child, childId);
  }
}

function mintApiKey(state: StackState, userId: string) {
  const output = convexCli(state, [
    "run",
    "mcp:createApiKeyForUser",
    JSON.stringify({ userId, name: "dev-verify" }),
  ]);
  const { apiKey } = JSON.parse(output) as { apiKey: string };
  return apiKey;
}
