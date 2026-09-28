export interface ExtractedField {
  key: string;
  value: string;
  confidence: number;
  page: number;
  bbox: null;
}

/**
 * Regex template for the synthetic demo award PDF format (§26.3). Each line of the form
 * `FAMILY: <uuid> HEAD: <headCode> AMOUNT: <rupees>` becomes one suggested field, keyed
 * `<affectedFamilyId>:<headCode>` so the review screen can map it straight onto an entitlement.
 * This is deliberately narrow — it is the "field extractor (regex templates for the synthetic
 * award format)" the spec calls for, not a general-purpose award-PDF parser.
 */
const FIELD_LINE =
  /FAMILY:\s*([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\s+HEAD:\s*([A-Z0-9_]+)\s+AMOUNT:\s*([\d,]+(?:\.\d{1,2})?)/g;

export function extractAwardFields(pages: string[]): ExtractedField[] {
  const fields: ExtractedField[] = [];
  pages.forEach((pageText, i) => {
    let m: RegExpExecArray | null;
    const re = new RegExp(FIELD_LINE);
    while ((m = re.exec(pageText))) {
      fields.push({
        key: `${m[1]}:${m[2]}`,
        value: m[3]!.replace(/,/g, ''),
        confidence: 0.95,
        page: i + 1,
        bbox: null,
      });
    }
  });
  return fields;
}

/** True when the extracted text is too thin per page to trust (§26.3: <200 chars/page → rasterise). */
export function textTooThin(text: string, pageCount: number): boolean {
  const perPage = text.length / Math.max(1, pageCount);
  return perPage < 200;
}
