/**
 * idを持つ祖先要素を検索
 */
export function findAncestorWithId(el: HTMLElement) {
  let parentWithId: HTMLElement | null = el.parentElement;
  let ancestor = null;
  while (parentWithId) {
    if (parentWithId.id) {
      ancestor = parentWithId;
      break;
    }
    parentWithId = parentWithId.parentElement;
  }
  return ancestor;
}
