// Upload type detection by magic bytes (§26.1), not by extension. Text formats (kml, geojson, csv)
// have no magic number: they must be valid UTF-8 and parse as what the extension claims.

export type Sniffed = { ext: string; mime: string };

const starts = (b: Buffer, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);
const ascii = (b: Buffer, s: string, at = 0) => b.subarray(at, at + s.length).toString('latin1') === s;

export function sniff(buf: Buffer, filename: string): Sniffed | null {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  if (ascii(buf, '%PDF-')) return { ext: 'pdf', mime: 'application/pdf' };
  if (starts(buf, [0xff, 0xd8, 0xff])) return { ext: 'jpg', mime: 'image/jpeg' };
  if (starts(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: 'png', mime: 'image/png' };
  if (ascii(buf, 'RIFF') && ascii(buf, 'WEBP', 8)) return { ext: 'webp', mime: 'image/webp' };
  if (ascii(buf, 'RIFF') && ascii(buf, 'WAVE', 8)) return { ext: 'wav', mime: 'audio/wav' };
  if (ascii(buf, 'ID3') || starts(buf, [0xff, 0xfb]) || starts(buf, [0xff, 0xf3]) || starts(buf, [0xff, 0xf2]))
    return { ext: 'mp3', mime: 'audio/mpeg' };
  if (ascii(buf, 'ftyp', 4) && /^(M4A |mp42|isom|M4B )/.test(buf.subarray(8, 12).toString('latin1')))
    return { ext: 'm4a', mime: 'audio/mp4' };
  if (starts(buf, [0x50, 0x4b, 0x03, 0x04])) {
    return ext === 'kmz'
      ? { ext: 'kmz', mime: 'application/vnd.google-earth.kmz' }
      : { ext: 'zip', mime: 'application/zip' };
  }
  // Text formats
  const text = buf.toString('utf8');
  if (Buffer.from(text, 'utf8').length !== buf.length || text.includes('\u0000')) return null;
  const trimmed = text.trimStart();
  if (ext === 'kml' && /^<\?xml|^<kml/i.test(trimmed))
    return { ext: 'kml', mime: 'application/vnd.google-earth.kml+xml' };
  if ((ext === 'geojson' || ext === 'json') && trimmed.startsWith('{')) {
    try {
      JSON.parse(text);
      return { ext: 'geojson', mime: 'application/geo+json' };
    } catch {
      return null;
    }
  }
  if (ext === 'csv') return { ext: 'csv', mime: 'text/csv' };
  return null;
}
