// Attestation declarations (§26.2, G21). A published version's text is NEVER edited — add ATTEST_V2.

export const DECLARATIONS = {
  ATTEST_V1:
    'I, {fullName}, {designation}, {jurisdiction}, certify that this document is authentic, that it is true and correct to the best of my knowledge, and that I am authorised to submit it for this project. Furnishing false information or a false document is punishable under section 84 of the Act with imprisonment up to six months, or fine up to one lakh rupees, or both.',
} as const;

export type DeclarationVersion = keyof typeof DECLARATIONS;
export const CURRENT_DECLARATION: DeclarationVersion = 'ATTEST_V1';

export function renderDeclaration(
  version: DeclarationVersion,
  vars: { fullName: string; designation: string; jurisdiction: string },
): string {
  return DECLARATIONS[version].replace(/\{(\w+)\}/g, (_, k: keyof typeof vars) => vars[k] ?? '');
}
