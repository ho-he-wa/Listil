/**
 * 子要素の数で要素を抽出する。
 * @param root
 * @param minChildrenNum
 * @param exclude 除外要素
 * @returns
 */
export function getElementsByChildCount(
  root: Element = document.body,
  minChildrenNum: number,
  exclude: string[] = []
): HTMLElement[] {
  const allElements = Array.from(
    root.querySelectorAll<HTMLElement>("*")
  ).filter((element) => !exclude.includes(element.tagName.toLowerCase()));
  return allElements.filter((element) => {
    const childElements = Array.from(element.children);
    return childElements.length >= minChildrenNum;
  });
}
