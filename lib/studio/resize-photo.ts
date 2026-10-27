/**
 * Shrinks a phone photo in the browser before it's uploaded: phones take
 * 4–12MB pictures, far past what a request can carry, and a menu reads fine
 * at 1600px. Returns base64 JPEG (no data: prefix). Browser only.
 */
export async function resizePhoto(file: File, maxSide = 1600, quality = 0.85): Promise<{ data: string; mime_type: "image/jpeg" }> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Couldn't read that photo.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const url = canvas.toDataURL("image/jpeg", quality);
    return { data: url.slice(url.indexOf(",") + 1), mime_type: "image/jpeg" };
}
