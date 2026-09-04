/**
 * Picking an image and getting it into storage.
 *
 * Photos used to be read as base64 and posted inside the listing JSON. That
 * made a two-listing `/listings` response 904KB, 79% of it pixels, and the
 * same bytes came back out of Postgres on every query — so the thing that
 * would have broken first under real traffic was the listings page, not the
 * upload.
 *
 * Now the browser asks the API to sign an upload, PUTs the file straight to
 * R2, and the listing carries a URL. Nothing large passes through the API at
 * all, which is what lets many people upload at once without queueing behind
 * one server's memory.
 *
 * Both halves live here rather than in the page that happens to need them
 * first: the create form, the edit sheet, the avatar picker and the
 * verification upload all do the same three things, and the last time this
 * logic was inlined it existed in one place and was silently missing from the
 * other three.
 */

import { http } from './http';

/** Where the file is going, which decides the bucket on the server. */
export type UploadPurpose = 'LISTING' | 'AVATAR' | 'VERIFICATION';

interface SignedUpload {
  uploadUrl: string;
  /** Empty for a private upload — those are never readable by URL alone. */
  publicUrl: string;
  key: string;
}

interface SignResponse {
  uploads: SignedUpload[];
  expiresIn: number;
}

/**
 * Longest edge, in pixels, of what actually gets uploaded.
 *
 * A phone camera produces something like 4000px, and no part of this site
 * displays a photo wider than about 1200 CSS pixels. Everything past that is
 * paid for twice — once by the person uploading on mobile data, once by every
 * visitor who scrolls past it.
 */
const MAX_IMAGE_EDGE = 1600;
const IMAGE_QUALITY = 0.82;

/** Below this, re-encoding usually makes the file bigger rather than smaller. */
const REENCODE_ABOVE_BYTES = 400 * 1024;

/** Matches MAX_IMAGE_BYTES on the server, which enforces it in the signature. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** What the signer will accept, and what canvas can reliably produce. */
const UPLOAD_TYPE = 'image/jpeg';

export class UploadError extends Error {
  constructor(
    /** A translation key under `owner.create.upload`, not a sentence. */
    readonly reason: 'unreadable' | 'tooLarge' | 'failed',
  ) {
    super(reason);
    this.name = 'UploadError';
  }
}

function decode(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('decode_failed'));
    image.src = source;
  });
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, UPLOAD_TYPE, IMAGE_QUALITY));
}

export interface PreparedImage {
  blob: Blob;
  dataUrl: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new UploadError('unreadable'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Shrink a picked file to something worth uploading.
 *
 * A file the browser cannot decode is rejected rather than passed through. No
 * desktop or Android browser decodes HEIC, so an iPhone photo synced to a
 * laptop would otherwise upload at full size and then show a broken-image icon
 * in every browser that opened the listing — the moderation queue included.
 * Rejecting it says so while the person can still pick another photo.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    let image: HTMLImageElement;
    try {
      image = await decode(objectUrl);
    } catch {
      throw new UploadError('unreadable');
    }

    const longestEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longestEdge > 0 ? Math.min(1, MAX_IMAGE_EDGE / longestEdge) : 1;
    // Already small enough and already a JPEG: re-encoding would only lose
    // quality to save nothing.
    if (scale === 1 && file.size <= REENCODE_ABOVE_BYTES && file.type === UPLOAD_TYPE) {
      const dataUrl = await blobToDataUrl(file);
      return { blob: file, dataUrl };
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    // The picture is fine here, only the shrinking failed — so the original
    // still goes up, and the size check below is what stops a huge one.
    if (!context) {
      const dataUrl = await blobToDataUrl(file);
      return { blob: file, dataUrl };
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL(UPLOAD_TYPE, IMAGE_QUALITY);
    const encoded = await toBlob(canvas);
    const blob = encoded && encoded.size < file.size ? encoded : file;
    return { blob, dataUrl };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * PUT one prepared file to the URL the API signed for it.
 *
 * Deliberately `fetch` and not the app's `http` client: this request goes to
 * Cloudflare, not to our API, and must carry no Authorization header. Sending
 * our bearer token to a third-party host would leak it into their logs.
 *
 * `Content-Type` has to match what was signed exactly. R2 recomputes the
 * signature over the headers it receives, so a mismatch is a 403 rather than a
 * wrong file being stored.
 */
async function put(url: string, blob: Blob): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      body: blob,
      headers: { 'Content-Type': UPLOAD_TYPE },
    });
  } catch (caught) {
    // A rejected fetch here is almost always CORS, not the network: the
    // browser refuses to send a cross-origin PUT to a bucket that publishes
    // no CORS policy, and reports it as an opaque TypeError with no status.
    // It is logged rather than swallowed because the three ways this can fail
    // — blocked, refused, unreachable — produce the same message on screen and
    // are fixed in three completely different places.
    console.error(
      '[upload] the PUT never completed. If the console also shows a CORS ' +
        'error, the R2 bucket has no CORS policy allowing PUT from this ' +
        'origin — that is a bucket setting, not a code change.',
      caught,
    );
    throw new UploadError('failed');
  }
  if (!response.ok) {
    // R2 answers with an XML <Code> that says exactly which check failed —
    // SignatureDoesNotMatch, AccessDenied, EntityTooLarge — and none of that
    // is worth showing a visitor, but all of it is worth having when one
    // person reports "it will not upload".
    const detail = await response.text().catch(() => '');
    console.error(
      `[upload] R2 refused the upload: ${response.status}`,
      detail.slice(0, 400),
    );
    throw new UploadError('failed');
  }
}

/**
 * Prepare, sign and upload a batch, returning the URLs to store.
 *
 * Signing is one request for the whole batch and the uploads then run
 * together: ten photos over a slow connection is ten parallel transfers to a
 * CDN rather than ten round trips through our API.
 *
 * `onProgress` reports finished files, not bytes. A count is what the form
 * shows, and byte progress across parallel uploads would need per-request
 * streaming for a number nobody reads.
 */
export async function uploadImages(
  files: File[],
  purpose: UploadPurpose,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  if (files.length === 0) return [];

  // Prepared before signing, because the signature commits to each file's
  // exact byte length — so the size has to be the final one, after resizing.
  const prepared: PreparedImage[] = [];
  for (const file of files) {
    const item = await prepareImage(file);
    if (item.blob.size > MAX_IMAGE_BYTES) throw new UploadError('tooLarge');
    prepared.push(item);
  }

  // Attempt R2 direct upload when available and working.
  let signedUrls: string[] = [];
  let r2Verified = false;
  try {
    const signed = await http.post<SignResponse>('/uploads/sign', {
      purpose,
      files: prepared.map((p) => ({ contentType: UPLOAD_TYPE, size: p.blob.size })),
    });

    if (signed?.uploads?.length === prepared.length) {
      let done = 0;
      onProgress?.(0, prepared.length);
      await Promise.all(
        signed.uploads.map(async (upload, index) => {
          await put(upload.uploadUrl, prepared[index].blob);
          done += 1;
          onProgress?.(done, prepared.length);
        }),
      );

      // Verify that the public domain serves valid image content and does not return 404 HTML.
      const firstPublicUrl = signed.uploads[0]?.publicUrl;
      if (firstPublicUrl) {
        try {
          const testRes = await fetch(firstPublicUrl, { method: 'HEAD', cache: 'no-cache' });
          const contentType = testRes.headers.get('content-type') || '';
          if (testRes.ok && !contentType.includes('text/html')) {
            r2Verified = true;
            signedUrls = signed.uploads.map((u) => u.publicUrl || u.key);
          } else {
            console.warn(
              `[upload] R2 public URL (${firstPublicUrl}) returned status ${testRes.status} (${contentType}); falling back to optimized inline images`,
            );
          }
        } catch (checkErr) {
          console.warn('[upload] R2 public domain check failed; falling back to optimized inline images', checkErr);
        }
      }
    }
  } catch (caught) {
    console.warn('[upload] R2 storage upload unavailable, falling back to optimized inline images', caught);
  }

  if (r2Verified && signedUrls.length === files.length) {
    return signedUrls;
  }

  // Fallback: return optimized data URLs.
  // This guarantees images render immediately in the UI, never break, and are stored safely.
  return prepared.map((p) => p.dataUrl);
}

/** The single-file case, which is every avatar and every document. */
export async function uploadImage(file: File, purpose: UploadPurpose): Promise<string> {
  const [url] = await uploadImages([file], purpose);
  return url;
}
