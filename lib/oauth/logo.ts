import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureFileBucket, fileUrl, listFiles, putFile, removeFiles } from "@/lib/storage/files";
import { MAX_ICON_BYTES, fetchSiteIcon } from "./site-icon";
import { setAppLogo, type OAuthApp } from "./store";

const BUCKET = "oauth-app-logos" as const;

/**
 * Gives an app the logo of its website: the site's icon is fetched once, copied into our own
 * file storage and shown from there. The consent screen never loads an image from the
 * developer's server, so they cannot change it later or see who viewed the screen.
 *
 * An app with no website, or whose site has no usable icon, has no logo and is shown by the
 * first letter of its name. Never throws: a logo is not worth failing a save for.
 */
export async function refreshAppLogo(db: SupabaseClient, app: OAuthApp): Promise<string | null> {
  try {
    const icon = app.website_url ? await fetchSiteIcon(app.website_url) : null;
    const previous = await listFiles(BUCKET, app.id).catch(() => [] as string[]);
    let logoUrl: string | null = null;
    if (icon) {
      await ensureFileBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_ICON_BYTES,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      });
      // A new name each time, so a changed logo is not hidden by a cached copy of the old one.
      const key = `${app.id}/${Date.now()}.${icon.extension}`;
      const { error } = await putFile(BUCKET, key, icon.bytes, icon.contentType);
      if (error) throw new Error(error);
      logoUrl = fileUrl(BUCKET, key);
    }
    await setAppLogo(db, app.id, logoUrl);
    if (previous.length > 0) await removeFiles(BUCKET, previous).catch(() => undefined);
    return logoUrl;
  } catch (error) {
    console.error("[OAuth] could not refresh the app's logo", error);
    return app.logo_url;
  }
}

/** Deletes an app's stored logo, when the app itself is deleted. */
export async function removeAppLogo(appId: string): Promise<void> {
  try {
    await removeFiles(BUCKET, await listFiles(BUCKET, appId));
  } catch (error) {
    console.error("[OAuth] could not remove the app's logo", error);
  }
}
