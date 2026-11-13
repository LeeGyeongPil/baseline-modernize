/** Maps a character offset to a 1-based line and column. */
export class LineTable {
  private readonly starts: number[] = [0];

  constructor(src: string) {
    for (let i = 0; i < src.length; i++) {
      if (src.charCodeAt(i) === 10) this.starts.push(i + 1);
    }
  }

  position(offset: number): { line: number; column: number } {
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((this.starts[mid] as number) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - (this.starts[lo] as number) + 1 };
  }
}

/** Collapse whitespace so a re-indented line keeps the same fingerprint. */
export function normalizeSnippet(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
