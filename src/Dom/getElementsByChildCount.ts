/**
 * 子要素の数で要素を抽出する。
 * @param root
 * @param minChildrenNum
 * @param parExclude 除外要素(親)
 * @param chiExclude 除外要素(子)
 * @returns
 */
export function getElementsByChildCount(
  root: Element = document.body,
  minChildrenNum: number,
  parExclude: string[] = [],
  chiExclude: string[] = []
): HTMLElement[] {
  const allElements = Array.from(
    root.querySelectorAll<HTMLElement>("*")
  ).filter((element) => !parExclude.includes(element.tagName.toLowerCase()));
  return allElements.filter((element) => {
    const childElements = Array.from(element.children).filter(
      (element) => !chiExclude.includes(element.tagName.toLowerCase())
    );
    return childElements.length >= minChildrenNum;
  });
}
