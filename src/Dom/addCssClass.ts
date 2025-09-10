/**
 * クラス属性を更新。ただし既に設定済の場合は何もしない。
 */
export function addCssClass(el: HTMLElement, token: string) {
  if (el.classList.contains(token)) {
    return;
  }
  el.classList.add(token);
}
