import "server-only";

import { GoogleGenerativeAI, SchemaType, type ResponseSchema } from "@google/generative-ai";
import { parsePrice } from "@/lib/embedded/catalog-format";

/**
 * Products read from pictures or text by Gemini: screenshots of a WhatsApp
 * catalog or Instagram, photos of a price list, a pasted list. Data for the
 * owner to review, never saved from here.
 */

const MODEL = "gemini-2.5-flash";

const PROMPT = `Read the products a business sells from these screenshots, photos or text: a WhatsApp catalog, Instagram posts, an online store, a price list.

For each product give:
- name: as shown, without the price.
- price: the number only, in the currency shown (₦12,500 → 12500). If a product has several prices for sizes or options, use the lowest and list the options.
- options: sizes, colours or variants shown, comma separated, with their prices if they differ ("Small ₦3,000, Large ₦4,500"). Empty if none.
- stock: units left if shown, else null.
- description: one short line if one is shown, else empty.

Copy only what's shown. Skip anything without a readable price. The same product shown twice is listed once. If there are no products at all, return an empty list.`;

const SCHEMA: ResponseSchema = {
    type: SchemaType.OBJECT,
    properties: {
        products: {
            type: SchemaType.ARRAY,
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    name: { type: SchemaType.STRING },
                    price: { type: SchemaType.NUMBER },
                    options: { type: SchemaType.STRING },
                    stock: { type: SchemaType.INTEGER, nullable: true },
                    description: { type: SchemaType.STRING },
                },
                required: ['name', 'price'],
            },
        },
    },
    required: ['products'],
};

export interface ReadProduct { name: string; price: number; options: string; stock: number | null; description: string }

export async function readProducts(apiKey: string, input: { images: Array<{ inlineData: { data: string; mimeType: string } }>; text: string }): Promise<ReadProduct[]> {
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
        model: MODEL,
        generationConfig: { temperature: 0, maxOutputTokens: 16_384, responseMimeType: "application/json", responseSchema: SCHEMA },
    });
    const result = await model.generateContent([PROMPT, ...(input.text ? [`Text:\n${input.text}`] : []), ...input.images]);
    const parsed = JSON.parse(result.response.text()) as { products?: Array<Record<string, unknown>> };
    return (parsed.products ?? []).flatMap((item) => {
        const name = typeof item.name === "string" ? item.name.trim().slice(0, 120) : "";
        const price = parsePrice(item.price);
        if (!name || price === null) return [];
        return [{
            name,
            price,
            options: typeof item.options === "string" ? item.options.trim().slice(0, 200) : "",
            stock: typeof item.stock === "number" && Number.isFinite(item.stock) ? Math.max(0, Math.floor(item.stock)) : null,
            description: typeof item.description === "string" ? item.description.trim().slice(0, 500) : "",
        }];
    });
}
