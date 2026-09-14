import { NextResponse, type NextRequest } from "next/server";
import { suggestHamlets } from "@/lib/geocode";
import { REGION_CODE } from "@/lib/regions";
import { getCurrentUser } from "@/lib/session";

/** Dusun names OpenStreetMap has around a picked village, offered under the location picker's hamlet field. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.status !== "active") return new Response("Unauthorized", { status: 401 });

  const params = request.nextUrl.searchParams;
  const code = params.get("code") ?? "";
  const [village, district, regency, province] = ["village", "district", "regency", "province"].map((key) => params.get(key)?.trim() ?? "");
  const names = [village, district, regency, province];
  if (code.split(".").length !== 4 || !REGION_CODE.test(code) || names.some((name) => !name || name.length > 120)) {
    return new Response("Bad request", { status: 400 });
  }

  const hamlets = await suggestHamlets({ code, village: village!, district: district!, regency: regency!, province: province! }).catch((error) => {
    console.warn("Hamlet lookup failed", error);
    return [];
  });
  return NextResponse.json(hamlets, { headers: { "Cache-Control": "private, max-age=86400" } });
}
