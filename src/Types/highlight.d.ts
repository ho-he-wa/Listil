// Types/highlight.d.ts
interface Highlight extends Set<Range> {
  priority?: number;
}

interface HighlightRegistry {
  set(name: string, highlight: Highlight): void;
  get(name: string): Highlight | undefined;
  delete(name: string): boolean;
  clear(): void;
}

interface CSS {
  highlights: HighlightRegistry;
}

declare var CSS: CSS;
declare var Highlight: {
  prototype: Highlight;
  new (...ranges: Range[]): Highlight;
};
