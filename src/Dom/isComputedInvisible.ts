import { getContentBoxSize } from "@/Dom/getContentBoxSize";

/**
 * 要素は非表示か否か。計算後の状態で評価。DocumentFragment上では期待通りには機能しない。
 */
export function isComputedInvisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  const size = getContentBoxSize(el);
  const invisible =
    style.display === "none" || size.width === 0 || size.height === 0;
  return invisible;
}
