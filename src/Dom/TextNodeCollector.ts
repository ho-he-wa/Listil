/**
 * テキストノードの収集。
 */
export class TextNodeCollector {
  public constructor(public readonly rootElement: HTMLElement) {}
  public collect() {
    const textNodes: Node[] = [];
    const nodeRanges: [number, number][] = [];
    const fullTextParts: string[] = [];
    /**
     * Note : この関数はDOMを木構造の上から順に（深さ優先）たどってテキストノードを収集する。そのためtextNodes[]はDOM出現順、nodeRangesはstart昇順となる。
     */
    const collectTextNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const start = fullTextParts.join("").length;
        const text = node.textContent ?? "";
        fullTextParts.push(text);
        const end = start + text.length;
        textNodes.push(node);
        // 各テキストノードの [startOffsetInFlatText, endOffset)
        nodeRanges.push([start, end]);
      } else {
        for (const child of node.childNodes as any) {
          collectTextNodes(child);
        }
      }
    };

    collectTextNodes(this.rootElement);
    const fullText = fullTextParts.join("");
    return {
      /** テキストノードのリスト(出現順) */
      textNodes,
      /** テキストノードのテキスト全体での開始位置・終了位置のリスト(出現順)。要素は各テキストノードの [startOffsetInFlatText, endOffset) */
      nodeRanges,
      /** テキストノードのテキストのリスト(出現順) */
      fullTextParts,
      /** テキストノードをすべて結合したテキスト */
      fullText,
    };
  }
}
