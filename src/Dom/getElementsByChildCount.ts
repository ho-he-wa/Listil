type getElementsByChildCountOptions = {
  /** 除外要素タグ(親) */
  parExclude?: string[];
  /** 除外要素タグ(子) */
  chiExclude?: string[];
  /**  カスタム追加フィルタ */
  chiFilter?: (el: HTMLElement) => boolean;
};

/**
 * 子要素の数で要素を抽出する。
 * @param root
 * @param minChildrenNum
 * @param options
 * @returns
 */
export function getElementsByChildCount(
  root: Element = document.body,
  minChildrenNum: number,
  options: getElementsByChildCountOptions = {}
): HTMLElement[] {
  const { parExclude = [], chiExclude = [], chiFilter = () => true } = options;
  const allElements = Array.from(root.querySelectorAll<HTMLElement>("*"))
    // 除外タグを除外
    .filter((element) => !parExclude.includes(element.tagName.toLowerCase()));
  return allElements.filter((element) => {
    const childElements = (Array.from(element.children) as HTMLElement[])
      // 除外タグを除外
      .filter((element) => !chiExclude.includes(element.tagName.toLowerCase()))
      // カスタム追加フィルタで除外
      .filter(chiFilter);
    return childElements.length >= minChildrenNum;
  });
}
