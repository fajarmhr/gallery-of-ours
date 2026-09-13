import type { Metadata } from "next";
import { GlobeView } from "@/components/places/globe";
import { mediaUrl } from "@/lib/format";
import { getPlacesOverview } from "@/lib/queries";
import { requireActiveUser } from "@/lib/session";

export const metadata: Metadata = { title: "Globe" };

export default async function GlobePage() {
  const user = await requireActiveUser();
  const places = await getPlacesOverview(user.id);
  return (
    <GlobeView
      places={places.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, count: p.count, coverUrl: mediaUrl(p.coverId, "thumb") }))}
    />
  );
}
