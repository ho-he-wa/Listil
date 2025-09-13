import { TextNodeCollector } from "@/Dom/TextNodeCollector";
import { copyRegExp } from "@/RegExp/copyRegExp";

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
    const regExpWk = copyRegExp(regExp, { flagsToAdd: "g" });
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
    // 1. TextNode をすべて集め、仮想テキストを構築
    const collector = new TextNodeCollector(this.rootElement);
    const { textNodes, nodeRanges, fullText } = collector.collect();

    // 2. 正規表現にマッチした Range のリストを作る
    const ranges: Range[] = [];
    const regExpWk = copyRegExp(regExp, { flagsToAdd: "g" });
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
