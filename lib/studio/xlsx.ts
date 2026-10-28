/**
 * The first sheet of an Excel file (.xlsx) as CSV text, in the browser, so a
 * store's Excel export goes through the same import as a CSV one. An .xlsx is
 * a zip of XML files: this reads the zip's directory, unpacks the sheet and
 * its shared strings with the browser's own DecompressionStream, and reads
 * the cells. No library; values only (formulas come as their last result).
 */

type ZipEntry = { name: string; method: number; compressedSize: number; localOffset: number };

function entries(view: DataView): ZipEntry[] {
    // The end-of-directory record sits in the last 64 KB (after an optional comment).
    let end = -1;
    for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 65_557); i--) {
        if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw new Error("That isn't an Excel file.");
    const count = view.getUint16(end + 10, true);
    let at = view.getUint32(end + 16, true);
    const list: ZipEntry[] = [];
    const decoder = new TextDecoder();
    for (let i = 0; i < count; i++) {
        if (view.getUint32(at, true) !== 0x02014b50) break;
        const nameLength = view.getUint16(at + 28, true);
        const extraLength = view.getUint16(at + 30, true);
        const commentLength = view.getUint16(at + 32, true);
        list.push({
            method: view.getUint16(at + 10, true),
            compressedSize: view.getUint32(at + 20, true),
            localOffset: view.getUint32(at + 42, true),
            name: decoder.decode(new Uint8Array(view.buffer, view.byteOffset + at + 46, nameLength)),
        });
        at += 46 + nameLength + extraLength + commentLength;
    }
    return list;
}

async function unpack(view: DataView, entry: ZipEntry): Promise<string> {
    const local = entry.localOffset;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const bytes = new Uint8Array(view.buffer as ArrayBuffer, view.byteOffset + start, entry.compressedSize);
    if (entry.method === 0) return new TextDecoder().decode(bytes);
    if (entry.method !== 8) throw new Error("This Excel file is packed in a way we can't read. Save it as CSV instead.");
    const source = new ReadableStream<BufferSource>({ start(controller) { controller.enqueue(bytes); controller.close(); } });
    const stream = source.pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(stream).text();
}

function columnIndex(ref: string): number {
    const letters = ref.replace(/\d+$/, "");
    let index = 0;
    for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
    return index - 1;
}

const csvCell = (value: string) => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export async function xlsxToCsv(file: Blob | ArrayBuffer): Promise<string> {
    const view = new DataView(typeof (file as Blob).arrayBuffer === "function" ? await (file as Blob).arrayBuffer() : file as ArrayBuffer);
    const list = entries(view);
    // The first sheet in the workbook's order is sheet1 in every export we've seen; else the first one there is.
    const sheet = list.find((entry) => entry.name === "xl/worksheets/sheet1.xml") ?? list.find((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name));
    if (!sheet) throw new Error("No sheet in that Excel file.");
    const sharedEntry = list.find((entry) => entry.name === "xl/sharedStrings.xml");
    const parser = new DOMParser();
    const shared = sharedEntry
        ? Array.from(parser.parseFromString(await unpack(view, sharedEntry), "application/xml").getElementsByTagName("si")).map((si) => Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""))
        : [];

    const doc = parser.parseFromString(await unpack(view, sheet), "application/xml");
    const rows: string[][] = [];
    for (const row of Array.from(doc.getElementsByTagName("row"))) {
        const cells: string[] = [];
        for (const cell of Array.from(row.getElementsByTagName("c"))) {
            const type = cell.getAttribute("t");
            const raw = cell.getElementsByTagName("v")[0]?.textContent ?? "";
            const value = type === "s" ? shared[Number(raw)] ?? ""
                : type === "inlineStr" ? Array.from(cell.getElementsByTagName("t")).map((t) => t.textContent ?? "").join("")
                    : raw;
            const ref = cell.getAttribute("r");
            const index = ref ? columnIndex(ref) : cells.length;
            while (cells.length < index) cells.push("");
            cells[index] = value;
        }
        rows.push(cells);
    }
    return rows.map((cells) => cells.map(csvCell).join(",")).join("\n");
}
