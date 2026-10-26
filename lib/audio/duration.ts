/**
 * Audio duration from raw bytes.
 *
 * Some providers bill by seconds of audio rather than characters of text or a
 * duration they report back (Spitch charges per second of generated speech and
 * per second of uploaded audio). For those we measure the audio ourselves.
 *
 * Supports WAV (RIFF header) and MP3 (summed MPEG frame durations). Anything
 * else returns null so the caller can fall back to another billing unit.
 */

/** Duration in seconds, or null when the bytes are not a format we can read. */
export function audioDurationSeconds(input: ArrayBuffer | Uint8Array): number | null {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    if (bytes.length < 12) return null;
    if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') {
        return wavDuration(bytes);
    }
    return mp3Duration(bytes);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
    return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

// ── WAV ─────────────────────────────────────────────────────────

function wavDuration(bytes: Uint8Array): number | null {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let byteRate = 0;
    let offset = 12;
    while (offset + 8 <= bytes.length) {
        const id = ascii(bytes, offset, 4);
        const size = view.getUint32(offset + 4, true);
        const body = offset + 8;
        if (id === 'fmt ' && body + 12 <= bytes.length) {
            byteRate = view.getUint32(body + 8, true);
        } else if (id === 'data') {
            if (!byteRate) return null;
            // Streamed WAVs often leave the size as 0 or 0xFFFFFFFF because it
            // wasn't known when the header was written; count what arrived.
            const remaining = bytes.length - body;
            const dataBytes = size === 0 || size > remaining ? remaining : size;
            return dataBytes / byteRate;
        }
        // Chunks are word-aligned.
        offset = body + size + (size % 2);
    }
    return null;
}

// ── MP3 ─────────────────────────────────────────────────────────

// Kbps by [MPEG-1 | MPEG-2/2.5][layer I, II, III], indexed by the header's bitrate bits.
const BITRATES: Record<string, number[]> = {
    '1-1': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    '1-2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    '1-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    '2-1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    '2-2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    '2-3': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};

// Hz by version bits: 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5.
const SAMPLE_RATES: Record<number, number[]> = {
    3: [44100, 48000, 32000],
    2: [22050, 24000, 16000],
    0: [11025, 12000, 8000],
};

function mp3Duration(bytes: Uint8Array): number | null {
    let offset = 0;

    // Skip an ID3v2 tag: 10-byte header, syncsafe size, optional footer.
    if (ascii(bytes, 0, 3) === 'ID3' && bytes.length >= 10) {
        const size = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
        offset = 10 + size + (bytes[5] & 0x10 ? 10 : 0);
    }

    let seconds = 0;
    let frames = 0;
    let gaplessSamples = 0;
    let sampleRate = 0;
    while (offset + 4 <= bytes.length) {
        const frame = readFrame(bytes, offset);
        if (!frame) {
            // Not a frame header here (junk or a trailing tag): resync byte by byte.
            offset += 1;
            continue;
        }
        // Encoders put a silent Xing/Info frame first, often with a LAME tag
        // naming the samples of encoder delay and padding around the audio.
        // Neither is speech, so neither is billed.
        const info = frames === 0 ? readInfoFrame(bytes, offset, frame.length) : null;
        if (info) {
            gaplessSamples = info.delay + info.padding;
            sampleRate = frame.sampleRate;
        } else {
            seconds += frame.seconds;
            frames += 1;
        }
        offset += frame.length;
    }

    // A couple of accidental sync matches inside non-MP3 bytes isn't audio.
    if (frames < 2) return null;
    return sampleRate ? Math.max(0, seconds - gaplessSamples / sampleRate) : seconds;
}

/** The Xing/Info header frame's gapless delay and padding, or null if this isn't one. */
function readInfoFrame(bytes: Uint8Array, offset: number, length: number): { delay: number; padding: number } | null {
    const end = Math.min(offset + length, bytes.length);
    // The tag sits after the side information, whose size depends on version
    // and channel mode; looking for it inside the frame avoids that table.
    for (let i = offset + 4; i + 8 <= end; i++) {
        const tag = ascii(bytes, i, 4);
        if (tag !== 'Xing' && tag !== 'Info') continue;
        const flags = (bytes[i + 4] << 24) | (bytes[i + 5] << 16) | (bytes[i + 6] << 8) | bytes[i + 7];
        let lame = i + 8;
        if (flags & 0x1) lame += 4; // frame count
        if (flags & 0x2) lame += 4; // byte count
        if (flags & 0x4) lame += 100; // seek table
        if (flags & 0x8) lame += 4; // quality
        // LAME tag: 9-byte encoder string, then 12 bits of delay and 12 of padding at +21.
        if (lame + 24 > end) return { delay: 0, padding: 0 };
        const d = lame + 21;
        return {
            delay: (bytes[d] << 4) | (bytes[d + 1] >> 4),
            padding: ((bytes[d + 1] & 0x0f) << 8) | bytes[d + 2],
        };
    }
    return null;
}

function readFrame(bytes: Uint8Array, offset: number): { length: number; seconds: number; sampleRate: number } | null {
    const b1 = bytes[offset + 1];
    const b2 = bytes[offset + 2];
    if (bytes[offset] !== 0xff || (b1 & 0xe0) !== 0xe0) return null;

    const versionBits = (b1 >> 3) & 0x03;
    const layerBits = (b1 >> 1) & 0x03;
    const bitrateIndex = b2 >> 4;
    const sampleRateIndex = (b2 >> 2) & 0x03;
    if (versionBits === 1 || layerBits === 0 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
        return null;
    }

    const layer = 4 - layerBits; // bits 3/2/1 → layer I/II/III
    const mpeg1 = versionBits === 3;
    const bitrate = BITRATES[`${mpeg1 ? 1 : 2}-${layer}`][bitrateIndex] * 1000;
    const sampleRate = SAMPLE_RATES[versionBits][sampleRateIndex];
    const padding = (b2 >> 1) & 0x01;

    const samples = layer === 1 ? 384 : layer === 3 && !mpeg1 ? 576 : 1152;
    const length = layer === 1
        ? (Math.floor((12 * bitrate) / sampleRate) + padding) * 4
        : Math.floor(((samples / 8) * bitrate) / sampleRate) + padding;
    if (length < 4) return null;

    return { length, seconds: samples / sampleRate, sampleRate };
}
