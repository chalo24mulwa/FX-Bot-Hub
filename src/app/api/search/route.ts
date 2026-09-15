import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuthorization } from "@/lib/authorization";
import { checkRateLimit, clientIp } from "@/lib/security/rate-limit";
import { searchService } from "@/lib/search";
import { track } from "@/lib/analytics/track";
import { auth } from "@/lib/auth";
import type { SearchEntityType } from "@/lib/search";

const querySchema = z.object({
  q: z.string().min(1).max(200),
  types: z
    .string()
    .optional()
    .transform((v) => v?.split(",").filter((t): t is SearchEntityType => ["product", "news", "signal"].includes(t))),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * Cross-entity search — GET, unauthenticated (a public search box doesn't
 * need a session), rate-limited by IP since it has no other natural key.
 * Consistent envelope ({results, query}) matching the rest of this app's
 * list endpoints' `{items, total, ...}` shape in spirit, not this exact
 * field name, since search results aren't a single paginated list of one
 * type — see SearchResult's `type` tag for how a client tells them apart.
 */
export async function GET(request: NextRequest) {
  return withAuthorization(async () => {
    await checkRateLimit(clientIp(request), { bucket: "search:query", limit: 60, windowSeconds: 60 });

    const { searchParams } = new URL(request.url);
    const { q, types, limit } = querySchema.parse({
      q: searchParams.get("q") ?? "",
      types: searchParams.get("types") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const results = await searchService.search(q, { types, limit });

    const session = await auth();
    void track({ type: "SEARCH", userId: session?.user.id, metadata: { query: q, resultCount: results.length } });

    return NextResponse.json({ query: q, results });
  });
}
