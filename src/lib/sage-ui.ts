// What Sage AI tells the page to show. The Sage AI route streams plain
// text, and slips these in between two record-separator characters so
// the page can pull them out of the stream.

export const UI_MARK = "\u001e";

export type WordFields = {
  place?: string;
  people?: string;
  time?: string;
  visibility?: string;
};

// One thing a search found.
export type FoundWord = WordFields & {
  kind: string;
  id: string;
  word: string;
  body: string;
  createdAt?: string;
};

export type UiDirective =
  // A word fills WORD, the rectangle, and the row of four.
  | ({ type: "word"; word: string; body: string } & WordFields)
  // A dictionary's own view, or one of the app's panels, in the rectangle.
  | { type: "view"; id: string; name: string }
  | { type: "panel"; panel: "settings" | "organizations" | "new-notebook" | "reports" }
  // Search results, listed in the rectangle.
  | { type: "results"; query: { word?: string; body?: string } & WordFields; items: FoundWord[] }
  // Back to the blank search form.
  | { type: "clear" };

export function encodeDirective(d: UiDirective): string {
  return `${UI_MARK}${JSON.stringify(d)}${UI_MARK}`;
}

// Splits streamed text into the words to show and the directives in it.
// Returns what's left over when a directive hasn't fully arrived yet.
export function splitStream(buffer: string): { text: string; directives: UiDirective[]; rest: string } {
  let text = "";
  const directives: UiDirective[] = [];
  let i = 0;
  while (i < buffer.length) {
    const start = buffer.indexOf(UI_MARK, i);
    if (start === -1) {
      text += buffer.slice(i);
      return { text, directives, rest: "" };
    }
    text += buffer.slice(i, start);
    const end = buffer.indexOf(UI_MARK, start + 1);
    if (end === -1) return { text, directives, rest: buffer.slice(start) };
    try {
      directives.push(JSON.parse(buffer.slice(start + 1, end)) as UiDirective);
    } catch {
      // A broken directive is dropped; the reply text still shows.
    }
    i = end + 1;
  }
  return { text, directives, rest: "" };
}
