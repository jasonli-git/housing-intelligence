import { photoFor, photoSources } from "@/lib/photos";
import { PHOTO_ASPECT } from "@/lib/photoCrop";

/**
 * A state or county page's photograph (ARCHITECTURE #368), in the header beside the
 * title on a wide screen and behind it on a phone. The caption names the exact spot,
 * so the photo never claims to show the whole county; the credit names the photographer
 * and links the licence, as CC BY and BY-SA require, and says the copy was cropped.
 * Nothing renders for a place without one.
 */
export function PlacePhoto({ geoid }: { geoid: string }) {
  const photo = photoFor(geoid);
  if (!photo) return null;
  const avif = photoSources(photo, "avif");
  const webp = photoSources(photo, "webp");
  const altered = photo.credit.licence !== "Public domain" && photo.credit.licence !== "CC0";
  return (
    <figure className="place-photo print-hide">
      <picture>
        <source type="image/avif" srcSet={avif.srcSet} sizes="(max-width: 760px) 100vw, 480px" />
        <source type="image/webp" srcSet={webp.srcSet} sizes="(max-width: 760px) 100vw, 480px" />
        <img src={webp.largest} alt={photo.alt} width={1280} height={Math.round(1280 / PHOTO_ASPECT)} decoding="async" />
      </picture>
      <figcaption>
        <span className="place-photo-caption">{photo.caption}</span>
        <span className="place-photo-credit">
          Photo: <a href={photo.credit.source} rel="noopener">{photo.credit.artist}</a>,{" "}
          {photo.credit.licence === "Public domain" ? "public domain" : <a href={photo.credit.licence_url} rel="license noopener">{photo.credit.licence}</a>}
          {altered ? ", cropped" : ""}
        </span>
      </figcaption>
    </figure>
  );
}
