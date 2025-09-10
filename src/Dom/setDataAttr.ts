/**
 * データ属性を更新。ただし既に設定済の場合は何もしない。
 */
export function setDataAttr(el: HTMLElement, key: string, value: string) {
  if ((el.dataset[key] ?? undefined) === value) {
    return;
  }
  el.dataset[key] = value;
}
