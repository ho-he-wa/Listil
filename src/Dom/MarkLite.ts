/**
 * マーカー。Mark.jsの代替。
 */
export class MarkLite {
  private highlights = new Map();
  constructor(private rootElement: HTMLElement) {}

  markRegExp(
    regExp: RegExp,
    option: { className: string | undefined } = { className: undefined }
  ) {
    const textNodes: Node[] = [];
    const ranges: Range[] = [];

    // 1. DOM を走査して TextNode を収集

    /**
     * Note : この関数はDOMを木構造の上から順に（深さ優先）たどって TextNode を収集する。そのためtextNodes[]はDOM出現順となる。
     */ const collectTextNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        textNodes.push(node);
      } else {
        for (const child of node.childNodes as any) {
          collectTextNodes(child);
        }
      }
    };

    collectTextNodes(this.rootElement);

    // 2. 正規表現にマッチしたインデックスを探す
    // 各 TextNode に対して正規表現を適用（Mark.js に近い）
    const regExpWk = new RegExp(regExp.source, addFlags(regExp.flags, "g"));
    for (const node of textNodes) {
      const text = node.textContent ?? "";
      let match: RegExpExecArray | null;
      regExpWk.lastIndex = 0;

      while ((match = regExpWk.exec(text)) !== null) {
        // 3. 開始と終了インデックスに対応する TextNode + offset を探して Range を作る
        const start = match.index;
        const end = start + match[0].length;

        const range = new Range();
        range.setStart(node, start);
        range.setEnd(node, end);
        ranges.push(range);
      }
    }

    // 4. Highlight を登録
    this._registerHighlight(option.className ?? "default", ranges);
  }

  /**
   * ハイライトを登録（既存なら追加、新規なら作成）
   */
  private _registerHighlight(key: string, ranges: Range[]) {
    const existingHighlight = CSS.highlights.get(key);
    if (existingHighlight) {
      // const newRanges = [...ranges];
      // for (const range of existingHighlight) {
      //   newRanges.push(range);
      // }
      // const highlight = new Highlight(...newRanges);
      // this.highlights.set(key, highlight);
      // CSS.highlights.set(key, highlight);
      for (const range of ranges) {
        existingHighlight.add(range);
      }
      this.highlights.set(key, existingHighlight);
      return;
    }
    const highlight = new Highlight(...ranges);
    CSS.highlights.set(key, highlight);
    this.highlights.set(key, highlight);
  }

  /**
   * 全てのハイライトを解除
   */
  unmark() {
    for (const className of this.highlights.keys()) {
      CSS.highlights.delete(className);
    }
    this.highlights.clear();
  }

  /**
   * Highlight API が使用可能か確認
   */
  public static isHighlightApiSupported() {
    return (
      typeof CSS !== "undefined" &&
      typeof CSS.highlights !== "undefined" &&
      typeof Highlight !== "undefined"
    );
  }
}
/**
 * 与えられた正規表現フラグ文字列に、追加のフラグを重複なく加える。
 *
 * @param originalFlags - 例: "i"
 * @param flagsToAdd - 例: "g"
 * @returns 新しいフラグ文字列。例: "gi"
 */
function addFlags(originalFlags: string, flagsToAdd: string): string {
  const combined = new Set([...originalFlags, ...flagsToAdd]);
  return [...combined].sort().join(""); // フラグ順は推奨順にソート
}
