import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { audioDurationSeconds } from '../duration';

function wav(seconds: number, { sampleRate = 24000, dataSize }: { sampleRate?: number; dataSize?: number } = {}): Uint8Array {
    const byteRate = sampleRate * 2; // mono, 16-bit
    const samples = Math.round(seconds * byteRate);
    const bytes = new Uint8Array(44 + samples);
    const view = new DataView(bytes.buffer);
    const text = (offset: number, s: string) => [...s].forEach((c, i) => (bytes[offset + i] = c.charCodeAt(0)));
    text(0, 'RIFF');
    view.setUint32(4, 36 + samples, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, 'data');
    view.setUint32(40, dataSize ?? samples, true);
    return bytes;
}

// MPEG-1 layer III, 128 kbps, 44.1 kHz, no padding: 417-byte frames of 1152 samples.
function mp3(frames: number, { id3 = false } = {}): Uint8Array {
    const frame = new Uint8Array(417);
    frame.set([0xff, 0xfb, 0x90, 0x64]);
    const tag = id3 ? new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 20, ...new Array(20).fill(0)]) : new Uint8Array();
    const out = new Uint8Array(tag.length + frames * frame.length);
    out.set(tag);
    for (let i = 0; i < frames; i++) out.set(frame, tag.length + i * frame.length);
    return out;
}

describe('audioDurationSeconds', () => {
    it('reads a WAV from its header', () => {
        expect(audioDurationSeconds(wav(2.5))).toBeCloseTo(2.5, 3);
    });

    it('counts the bytes of a streamed WAV whose size field was never filled in', () => {
        expect(audioDurationSeconds(wav(1.5, { dataSize: 0xffffffff }))).toBeCloseTo(1.5, 3);
        expect(audioDurationSeconds(wav(1.5, { dataSize: 0 }))).toBeCloseTo(1.5, 3);
    });

    it('sums MP3 frame durations', () => {
        expect(audioDurationSeconds(mp3(100))).toBeCloseTo((100 * 1152) / 44100, 4);
    });

    it('skips an ID3 tag before the first frame', () => {
        expect(audioDurationSeconds(mp3(50, { id3: true }))).toBeCloseTo((50 * 1152) / 44100, 4);
    });

    it('leaves out the encoder header frame and padding of a real MP3', () => {
        // ffmpeg/LAME output, 1.25 s of tone: frames alone sum to ~1.34 s.
        const file = readFileSync(join(__dirname, 'fixtures', 'sine-1.25s.mp3'));
        expect(audioDurationSeconds(file)).toBeCloseTo(1.25, 2);
    });

    it('returns null for bytes it cannot read', () => {
        expect(audioDurationSeconds(new TextEncoder().encode('{"detail":"insufficient_credits"}'))).toBeNull();
        expect(audioDurationSeconds(new Uint8Array(4))).toBeNull();
    });
});
