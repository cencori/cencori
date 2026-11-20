import { NextRequest } from "next/server";
import { POST as inference } from "@/app/api/tensor/inference/v1/[...path]/route";

/**
 * What looks at pictures for Tensor. B.AI's deepseek-v4-flash-vision-exp, used before, was retired
 * (lib/vision/analyze.ts) and every description failed; Atlas 1.5 reads images, as Copilot's does.
 */
export const VISION_MODEL = "maximo-atlas-1.5";
const VISION_PROMPT =
  "Describe this image concisely for an assistant helping the person who sent it: what is shown, any text in it, UI, errors, and relevant details.";

/** A picture as a data URL Tensor reads: PNG, JPEG, GIF or WebP. */
export const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * One picture, described by the vision model through Tensor's own inference, on the caller's
 * reserved turn (the person's session is its authorization). Null when it could not be looked at.
 */
export async function describeImage(authorization: string, origin: string, url: string): Promise<string | null> {
  try {
    const answer = await inference(
      new NextRequest(`${origin}/api/tensor/inference/v1/chat/completions`, {
        method: "POST",
        headers: { authorization, "content-type": "application/json" },
        body: JSON.stringify({
          model: VISION_MODEL,
          max_tokens: 700,
          messages: [{ role: "user", content: [{ type: "text", text: VISION_PROMPT }, { type: "image_url", image_url: { url } }] }],
        }),
        signal: AbortSignal.timeout(45_000),
      }),
      { params: Promise.resolve({ path: ["chat", "completions"] }) },
    );
    if (!answer.ok) return null;
    const body = (await answer.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
    const text = body?.choices?.[0]?.message?.content?.trim();
    return text && text.length > 10 ? text.slice(0, 4000) : null;
  } catch (error) {
    console.error("[Tensor] Looking at an image failed", error);
    return null;
  }
}

/** The words a message carries for its pictures: what each shows, or that it could not be seen. */
export function imageNotes(descriptions: (string | null)[]): string {
  return descriptions
    .map((description, index) =>
      description
        ? `[Image ${index + 1} they attached, as described by a vision model: ${description}]`
        : `[Image ${index + 1} they attached could not be looked at. Say so; do not guess what it shows.]`,
    )
    .join("\n\n");
}
