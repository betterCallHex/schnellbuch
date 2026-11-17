import * as z from "zod";

// A text search parameter; anything else in the URL reads as absent.
export const optionalText = z.string().optional().catch(undefined);
