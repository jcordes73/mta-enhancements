/* Decode the HTML entities carried verbatim in generated data literals.
   The mock renders data via innerHTML, so entities decode in the browser;
   React renders text nodes literally, so data strings pass through dec(). */
const ENTITIES: Record<string, string> = {
  '&times;': '\u00d7',
  '&rarr;': '\u2192',
  '&larr;': '\u2190',
  '&mdash;': '\u2014',
  '&ndash;': '\u2013',
  '&middot;': '\u00b7',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': '\u00a0',
};

export function dec(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&(?:times|rarr|larr|mdash|ndash|middot|amp|lt|gt|quot|#39|nbsp);/g, m => ENTITIES[m]);
}
