import { requireUser } from "@/server/auth/session";
import { json, route } from "@/server/http";

export const GET = route("me", async (req) => json({ user: await requireUser(req) }));
