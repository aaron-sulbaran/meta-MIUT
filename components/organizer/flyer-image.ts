import type { FlyerImage } from "@/components/organizer/types";

// Phone photos are several megabytes; Muse needs about 1280 px and the server
// accepts a few megabytes at most. Shrink to a JPEG in the browser before sending.

const MAX_SIDE_PX = 1280;
const JPEG_QUALITY = 0.85;

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to an <img>, which decodes more formats on some browsers.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function prepareFlyer(file: File): Promise<{ data: FlyerImage; error: null } | { data: null; error: string }> {
  if (!file.type.startsWith("image/")) return { data: null, error: "That file is not an image. Pick a photo of the flyer." };
  try {
    const source = await loadBitmap(file);
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(source.width, source.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.width * scale));
    canvas.height = Math.max(1, Math.round(source.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return { data: null, error: "This browser cannot read the photo. Try another one." };
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return { data: null, error: "This browser cannot read the photo. Try another one." };
    const dataUrl = await readAsDataUrl(blob);
    return {
      data: { base64: dataUrl.slice(dataUrl.indexOf(",") + 1), mediaType: "image/jpeg", previewUrl: URL.createObjectURL(blob) },
      error: null,
    };
  } catch {
    return { data: null, error: "This browser cannot read that photo. Try a JPEG or PNG." };
  }
}
