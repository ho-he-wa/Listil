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
    const nodeRanges: [number, number][] = []; // 各 TextNode の [startOffsetInFlatText, endOffset)

    // 1. TextNode をすべて集め、仮想テキストを構築
    let fullText = "";
    const collectTextNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const start = fullText.length;
        fullText += node.textContent;
        const end = fullText.length;
        textNodes.push(node);
        nodeRanges.push([start, end]);
      } else {
        for (const child of node.childNodes as any) {
          collectTextNodes(child);
        }
      }
    };

    collectTextNodes(this.rootElement);

    // 2. 正規表現にマッチしたインデックスを探す
    const ranges: Range[] = [];
    const regExpWk = regExp.flags.includes("g")
      ? new RegExp(regExp.source, regExp.flags)
      : new RegExp(regExp.source, regExp.flags + "g");
    regExpWk.lastIndex = 0;
    let match;
    while ((match = regExpWk.exec(fullText)) !== null) {
      const startIdx = match.index;
      const endIdx = match.index + match[0].length;

      // 3. 開始と終了インデックスに対応する TextNode + offset を探して Range を作る
      const startInfo = this._findNodeOffset(textNodes, nodeRanges, startIdx);
      const endInfo = this._findNodeOffset(textNodes, nodeRanges, endIdx);

      if (startInfo && endInfo) {
        const range = new Range();
        range.setStart(startInfo.node, startInfo.offset);
        range.setEnd(endInfo.node, endInfo.offset);
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

  _findNodeOffset(
    nodes: Node[],
    nodeRanges: [number, number][],
    flatIndex: number
  ) {
    for (let i = 0; i < nodeRanges.length; i++) {
      const [start, end] = nodeRanges[i];
      if (flatIndex >= start && flatIndex <= end) {
        return {
          node: nodes[i],
          offset: flatIndex - start,
        };
      }
    }
    return null;
  }

  unmark() {
    for (const className of this.highlights.keys()) {
      CSS.highlights.delete(className);
    }
    this.highlights.clear();
  }

  public static isHighlightApiSupported() {
    return (
      typeof CSS !== "undefined" &&
      typeof CSS.highlights !== "undefined" &&
      typeof Highlight !== "undefined"
    );
  }
}
