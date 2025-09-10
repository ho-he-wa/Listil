/**
 * DOM要素の再描画の回数を抑えるための関数
 *
 * - DOM 要素に対して複数の変更を行う（スタイル変更、属性の更新など）と、DOM に接続されているとブラウザが毎回再描画してしまうため、パフォーマンスが悪化する。
 *   この関数は、一旦DOMから取り外して変更し、最後に再表示することで、再描画の最小化を図るものである。
 * @param element 操作対象の要素
 * @returns
 */
export function redrawOf(element: HTMLElement) {
  const parent = element.parentNode;
  if (!parent) {
    throw new Error("操作対象の要素に親要素がありません。");
  }
  const nextSibling = element.nextSibling;
  parent.removeChild(element);
  const api: {
    run: (callback: (el: HTMLElement) => void) => typeof api;
    show: () => void;
  } = {
    /**
     * DOM要素への処理
     */
    run: (callback: (el: HTMLElement) => void): typeof api => {
      try {
        callback(element);
      } catch (e) {
        console.error("コールバック関数内でエラーが発生しました:", e);
      }
      return api;
    },
    /**
     * 表示
     */
    show: (): void => {
      if (parent.contains(element)) {
        return;
      }
      if (nextSibling) {
        parent.insertBefore(element, nextSibling);
      } else {
        parent.appendChild(element);
      }
      console.log("DEBUG", "再表示を行いました。");
    },
  };
  return api;
}
