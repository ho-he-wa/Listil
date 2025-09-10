/**
 * 要素は非表示か否か。計算後の状態は評価しない。DocumentFragment上でも機能する。
 */
export function isDisplayNone(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  const invisible = style.display === "none";
  return invisible;
}
