import { NextResponse, type NextRequest } from "next/server";
import { reverseAddress } from "@/lib/geocode";
import { getCurrentUser } from "@/lib/session";

/** The administrative areas around a searched spot, so the location picker can fill in its dropdowns. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.status !== "active") return new Response("Unauthorized", { status: 401 });

  const params = request.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (!params.has("lat") || !params.has("lng") || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return new Response("Bad request", { status: 400 });
  }

  const result = await reverseAddress(lat, lng).catch((error) => {
    console.warn("Reverse lookup failed", error);
    return null;
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=3600" } });
}
