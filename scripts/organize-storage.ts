import { and, asc, eq, isNull, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { albums, media } from "@/db/schema";
import { ROOT_FOLDER } from "@/lib/storage";
import { albumFolder, organizeAlbum } from "@/lib/storage-layout";

/**
 * Files photos, videos and story music uploaded before album folders existed into gallery-of-ours/<album>/ in R2 and
 * Cloudinary, and moves files whose folder no longer matches their album. Photos imported from existing Cloudinary folders
 * stay where they are. Without --apply it only lists what would move.
 *
 *   pnpm storage:organize [--apply]         (development, .env.local)
 *   pnpm storage:organize:prod [--apply]    (production, .env.production.local)
 */
async function main() {
  const apply = process.argv.includes("--apply");
  const totals = { moved: 0, failed: 0 };

  for (const album of await db.select().from(albums).orderBy(asc(albums.createdAt))) {
    const folder = await albumFolder(album);
    if (!apply) {
      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(media)
        .where(
          and(
            eq(media.albumId, album.id),
            or(
              and(eq(media.source, "primary"), or(isNull(media.storagePath), sql`${media.originalKey} <> ${media.storagePath}`)),
              and(like(media.source, "cloudinary:%"), isNull(media.storagePath), or(sql`${media.originalKey} = ${media.id}::text`, like(media.originalKey, `${ROOT_FOLDER}/%`))),
            ),
          ),
        );
      const music = album.musicKey && !album.musicKey.startsWith(`${ROOT_FOLDER}/`) ? " + story music" : "";
      console.log(`${album.title} → ${ROOT_FOLDER}/${folder}/  ${row?.count ?? 0} not filed yet${music}`);
      continue;
    }
    const result = await organizeAlbum(album.id);
    totals.moved += result.moved;
    totals.failed += result.failed;
    console.log(`${album.title} → ${ROOT_FOLDER}/${folder}/  moved ${result.moved}${result.failed ? `, ${result.failed} failed` : ""}`);
  }

  console.log(apply ? `Done: ${totals.moved} moved, ${totals.failed} failed.` : "Nothing was moved. Run again with --apply to move the files.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
