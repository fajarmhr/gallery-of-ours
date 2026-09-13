import { eq, inArray, like } from "drizzle-orm";
import { db } from "@/db";
import { albums, media, milestones, user } from "@/db/schema";
import { mediaKeys, storage } from "@/lib/storage";

const DEMO_DOMAIN = "demo.gallery-of-ours.local";

async function main() {
  const files = await storage();
  const demoAlbums = await db.select({ id: albums.id }).from(albums).where(eq(albums.isDemo, true));
  const albumIds = demoAlbums.map((a) => a.id);
  const demoMedia = albumIds.length
    ? await db.select({ id: media.id }).from(media).where(inArray(media.albumId, albumIds))
    : [];

  for (const item of demoMedia) await files.removePrefix(mediaKeys(item.id).prefix);
  for (const id of albumIds) await files.removePrefix(`albums/${id}/`);
  if (albumIds.length) await db.delete(albums).where(inArray(albums.id, albumIds));
  await db.delete(milestones).where(eq(milestones.isDemo, true));
  const removedUsers = await db.delete(user).where(like(user.email, `%@${DEMO_DOMAIN}`)).returning({ id: user.id });

  console.log(`Removed ${albumIds.length} demo albums, ${demoMedia.length} photos and ${removedUsers.length} demo accounts.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
