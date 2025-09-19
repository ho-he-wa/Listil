import { getElementsByChildCount } from "@/Dom/getElementsByChildCount";
import { redrawOf } from "@/Dom/redrawOf";
import { HtmlElementSummary } from "@/List/HtmlElementSummary";

export const PseudoType = {
  list: "list",
  listitem: "listitem",
} as const;

/**
 * 実質リストにlist/listitemの識別タグを付加
 *
 * @param root - 探索の起点となるルート要素（デフォルトは document.body）
 */
export function addPseudoType(root: Element = document.body): void {
  // 子要素要素数で評価
  const comExclud = ["link", "script", "noscript"];
  const parExclude = [
    ...comExclud,
    "table",
    "ol",
    "ul",
    "tbody",
    "thead",
    "tfoot",
    // select, optgroup, datalistは配下に大量のoptionを持つので除外する
    "select",
    "optgroup",
    "datalist",
  ];
  const chiExclude = [...comExclud];
  const elementsWithManyChildren = getElementsByChildCount(
    root,
    20,
    parExclude,
    chiExclude
  );
  elementsWithManyChildren.forEach((elementWithManyChildren) => {
    redrawOf(elementWithManyChildren)
      .edit((element) => {
        const elementsSummary = new HtmlElementSummary(
          Array.from(element.children).filter((el) => el instanceof HTMLElement)
        );
        element.dataset.pseudotype = PseudoType.list;
        Array.from(element.children).map((child) => {
          if (!(child instanceof HTMLElement)) {
            return;
          }
          // なるべくリスト要素ではない要素を除外する
          if (!elementsSummary.maybeListItems().includes(child)) {
            return;
          }
          child.dataset.pseudotype = PseudoType.listitem;
        });
      })
      .show();
  });
  // 子要素のリスト要素候補で評価
  const candidateItems = Array.from(
    root.querySelectorAll<HTMLElement>(
      'div[role="listitem"], p[role="listitem"]'
    )
  );
  const groups = new Map<HTMLElement, HTMLElement[]>();
  for (const item of candidateItems) {
    if (item.dataset.pseudotype === PseudoType.listitem) {
      // 既に識別タグ付与済であればスキップ
      continue;
    }
    const list = item.parentElement;
    if (!list) {
      continue;
    }
    if (!groups.has(list)) {
      // リスト要素配列を初期化
      groups.set(list, []);
    }
    const listItems = groups.get(list)!;
    listItems.push(item);
  }
  for (const [list, items] of groups) {
    if (items.length < 5) {
      continue;
    }
    redrawOf(list)
      .edit((list) => {
        list.dataset.pseudotype = PseudoType.list;
        for (const item of items) {
          item.dataset.pseudotype = PseudoType.listitem;
        }
      })
      .show();
  }
}
