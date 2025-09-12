/**
 * マーカー。Mark.jsの代替。
 */
export class MarkLite {
  private highlights = new Map<string, Highlight>();
  private crossNode: boolean;

  constructor(
    private rootElement: HTMLElement,
    options?: { crossNode?: boolean }
  ) {
    this.crossNode = options?.crossNode ?? false;
  }

  markRegExp(regExp: RegExp, option: { className?: string } = {}) {
    const className = option.className ?? "default";
    if (this.crossNode) {
      this.markRegExpCrossNode(regExp, className);
    } else {
      this.markRegExpSingleNode(regExp, className);
    }
  }

  /**
   * ノードをまたがずに文字列にマーカーをひく。軽量。
   */
  private markRegExpSingleNode(regExp: RegExp, className: string) {
    const ranges: Range[] = [];

    // 1. DOM を走査しテキストを抽出する
    const walker = document.createTreeWalker(
      this.rootElement,
      NodeFilter.SHOW_TEXT,
      null
    );

    // 2. 正規表現にマッチした Range のリストを作る。各 TextNode に対して正規表現を適用（Mark.js に近い）
    let node: Text | null;
    const regExpWk = new RegExp(regExp.source, addFlags(regExp.flags, "g"));
    while ((node = walker.nextNode() as Text | null)) {
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
    this._registerHighlight(className, ranges);
  }

  /**
   * ノードをまたいで文字列にマーカーをひく。処理が重たいので注意。
   */
  private markRegExpCrossNode(regExp: RegExp, className: string) {
    /** テキストノードのリスト(出現順) */
    const textNodes: Node[] = [];
    /** テキストノードのテキスト全体での開始位置・終了位置のリスト(出現順) */
    const nodeRanges: [number, number][] = []; // 各 TextNode の [startOffsetInFlatText, endOffset)

    // 1. TextNode をすべて集め、仮想テキストを構築
    /** テキストノードのテキストのリスト(出現順) */
    const fullTextParts: string[] = [];
    /**
     * Note : この関数はDOMを木構造の上から順に（深さ優先）たどって TextNode を収集する。そのためtextNodes[]はDOM出現順、nodeRangesはstart昇順となる。
     */
    const collectTextNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const start = fullTextParts.join("").length;
        const text = node.textContent ?? "";
        fullTextParts.push(text);
        const end = start + text.length;
        textNodes.push(node);
        nodeRanges.push([start, end]);
      } else {
        for (const child of node.childNodes as any) {
          collectTextNodes(child);
        }
      }
    };

    collectTextNodes(this.rootElement);
    const fullText = fullTextParts.join("");

    // 2. 正規表現にマッチした Range のリストを作る
    const ranges: Range[] = [];
    const regExpWk = new RegExp(regExp.source, addFlags(regExp.flags, "g"));
    regExpWk.lastIndex = 0;
    let match: RegExpExecArray | null;
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
    this._registerHighlight(className, ranges);
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
   * flatIndex（仮想テキスト内の位置）から node + offset を取得（二分探索）
   */
  private _findNodeOffset(
    nodes: Node[],
    nodeRanges: [number, number][],
    flatIndex: number
  ): { node: Node; offset: number } | null {
    let low = 0;
    let high = nodeRanges.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const [start, end] = nodeRanges[mid];

      if (flatIndex < start) {
        high = mid - 1;
      } else if (flatIndex >= end) {
        low = mid + 1;
      } else {
        return {
          node: nodes[mid],
          offset: flatIndex - start,
        };
      }
    }
    return null;
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
