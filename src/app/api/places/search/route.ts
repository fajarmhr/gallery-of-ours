import { NextResponse, type NextRequest } from "next/server";
import { searchPlaces } from "@/lib/geocode";
import { getCurrentUser } from "@/lib/session";

/** Place suggestions for the location picker. Family members only, so it isn't an open proxy. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.status !== "active") return new Response("Unauthorized", { status: 401 });

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) return NextResponse.json([]);

  const results = await searchPlaces(query).catch((error) => {
    console.warn("Place search failed", error);
    return [];
  });
  return NextResponse.json(results, { headers: { "Cache-Control": "private, max-age=300" } });
}
