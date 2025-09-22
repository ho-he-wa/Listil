import { getContentBoxSize } from "@/Dom/getContentBoxSize";

/**
 * 要素は非表示か否か。計算後の状態で評価。DocumentFragment上では期待通りには機能しない。
 */
export function isComputedInvisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === "none") {
    return true;
  }
  if (!el.isConnected) {
    // EXP : 試験的実装。DocumentFragment上でもサイズ評価を行う
    // NOTE : Documentに接続してサイズを評価するとMutationObserverによる変更監視に影響が出る。監視内でaddPseudoType()していると変更検出＆変更の無限ループが発生した
    // const size = measureElementSize(el);
    // return size.width === 0 || size.height === 0;
    console.log(
      "isComputedInvisible() does not support elements that are not connected to the Document."
    );
  }
  const size = getContentBoxSize(el);
  return size.width === 0 || size.height === 0;
}

/**
 * DOMに接続した状態でサイズを評価する。
 * @param element
 */
function measureElementSize(
  element: HTMLElement,
  connectTo: HTMLElement = document.body
) {
  const orgStyle = {
    position: element.style.position,
    visibility: element.style.visibility,
  };
  element.style.position = "absolute"; // レイアウト干渉を避ける
  element.style.visibility = "hidden"; // レイアウトに含まれるが非表示
  connectTo.appendChild(element);
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  // 元のに戻す
  element.style.position = orgStyle.position;
  element.style.visibility = orgStyle.visibility;
  connectTo.removeChild(element);
  return { width, height };
}
