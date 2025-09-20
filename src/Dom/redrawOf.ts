/**
 * DOM要素の再描画の回数を抑えるための関数
 *
 * - DOM 要素に対して複数の変更を行う（スタイル変更、属性の更新など）と、DOM に接続されているとブラウザが毎回再描画してしまうため、パフォーマンスが悪化する。
 *   この関数は、一旦非表示あるいはDOMから切り離して変更し、最後に再表示することで、再描画の最小化を図るものである。
 * @param element 操作対象の要素
 * @param options
 * @returns
 */
export function redrawOf(
  element: HTMLElement,
  options: {
    /**
     * DOMから切り離すか否か。より高速であるがエラーに注意。
     * 例えばscript要素を含む要素をDOMから切り離すと「Refused to load the script」エラーが発生する。
     */
    remove?: boolean;
  } = {}
) {
  const parent = element.parentNode;
  if (!parent) {
    throw new Error("操作対象の要素に親要素がありません。");
  }
  const nextSibling = element.nextSibling;
  options.remove && parent.removeChild(element);
  element.classList.add("listil-force-hidden");

  const api: {
    edit: (callback: (el: HTMLElement) => void) => typeof api;
    show: () => void;
  } = {
    /**
     * DOM要素への処理
     */
    edit: (callback: (el: HTMLElement) => void): typeof api => {
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
      element.classList.remove("listil-force-hidden");
      if (options.remove) {
        if (parent.contains(element)) {
          return;
        }
        if (nextSibling) {
          parent.insertBefore(element, nextSibling);
        } else {
          parent.appendChild(element);
        }
      }
      console.log("DEBUG", "再表示を行いました。");
    },
  };
  return api;
}
