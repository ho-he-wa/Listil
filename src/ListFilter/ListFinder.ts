import { querySelectorAllWithDepth } from "@/Dom/querySelectorAllWithDepth";
import { PseudoType } from "@/ListFilter/PseudoType";

/**
 * リストの検索処理
 */
export class ListFinder {
  private excludeSelector = "nav, footer, header, #nav, #footer, #header";
  private excludeSuffixes = ["menu", "Menu", "nav", "Nav"];
  private contentContainers: Element[];

  constructor(contentContainers: Element[]) {
    this.contentContainers = contentContainers;
  }

  public findLists(): HTMLElement[] {
    const lists: HTMLElement[] = [];

    this.contentContainers.forEach((container) => {
      const listElements = container.querySelectorAll<HTMLElement>(
        `ul, ol, table, [data-pseudotype="${PseudoType.list}"]`
      );

      listElements.forEach((list) => {
        if (!this.isEligibleList(list)) return;
        lists.push(list);
      });
    });

    return [...new Set(lists)];
  }

  /**
   * 処理対象のリストか
   */
  private isEligibleList(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();

    // 対象外の要素配下か
    if (el.closest(this.excludeSelector)) return false;
    if (this.hasExcludedAncestor(el)) return false;

    if (tag === "table") {
      // NOTE : tbodyを挟む場合があるので深さ2を指定
      // BUG : thead, tfootの行数もカウントしている
      return querySelectorAllWithDepth(el, "tr", 2).length >= 10;
    } else if (tag === "ul" || tag === "ol") {
      return querySelectorAllWithDepth(el, "li", 1).length >= 10;
    } else if (el.dataset.pseudotype === PseudoType.list) {
      return (
        querySelectorAllWithDepth(
          el,
          `[data-pseudotype="${PseudoType.listitem}"]`,
          1
        ).length >= 10
      );
    }

    return false;
  }

  /**
   * 対象外のサフィックスの祖先要素配下か
   */
  private hasExcludedAncestor(el: Element): boolean {
    let current: Element | null = el;
    while (current) {
      const id = current.id || "";
      const classList = Array.from(current.classList);

      const matches = this.excludeSuffixes.some(
        (suffix) =>
          id.endsWith(suffix) || classList.some((cls) => cls.endsWith(suffix))
      );

      if (matches) return true;

      current = current.parentElement;
    }

    return false;
  }
}
