// Client-side screenshot compression to stay under ~200KB.
const MAX_BYTES = 200 * 1024;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image"));
    };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression failed"))), "image/jpeg", quality),
  );
}

export async function compressScreenshot(
  file: File,
): Promise<{ base64: string; type: "image/jpeg"; bytes: number; previewUrl: string }> {
  const img = await loadImage(file);
  let maxSide = 1400;
  let quality = 0.8;
  let blob: Blob | null = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    blob = await toBlob(canvas, quality);
    if (blob.size <= MAX_BYTES) break;
    if (quality > 0.45) quality -= 0.12;
    else maxSide = Math.round(maxSide * 0.8);
  }
  if (!blob || blob.size > MAX_BYTES) throw new Error("Could not shrink the screenshot enough");

  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return { base64: btoa(bin), type: "image/jpeg", bytes: blob.size, previewUrl: URL.createObjectURL(blob) };
}
