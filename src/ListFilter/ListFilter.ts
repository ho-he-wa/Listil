import { CriterionFactory } from "@/Criteria/CriterionFactory";
import { addCssClass } from "@/Dom/addCssClass";
import { extractAttributeMaps } from "@/Dom/extractAttributeMaps";
import { extractValidFormElements } from "@/Dom/extractValidFormElements";
import { isDisplayNone } from "@/Dom/isDisplayNone";
import { querySelectorAllWithDepth } from "@/Dom/querySelectorAllWithDepth";
import { redrawOf } from "@/Dom/redrawOf";
import { setDataAttr } from "@/Dom/setDataAttr";
import {
  FilterSettingInterface,
  FilterSettingList,
} from "@/ListFilter/Interface";
import { PseudoType } from "@/ListFilter/PseudoType";
import { MarkLite } from "@/Mark/MarkLite";

/**
 * リストフィルター
 */
export class ListFilter {
  private list: HTMLElement;
  private settingList: FilterSettingList;
  private listSettingId: string | undefined;

  /**
   *
   * @param list 対象リスト
   * @param settingList フィルタ設定の配列
   */
  constructor(list: HTMLElement, settingList: FilterSettingList) {
    this.list = list;
    this.settingList = settingList;
    this.listSettingId = list.dataset.listSettingId;
  }

  /**
   * リストにフィルターを適用
   */
  public apply(
    timerName = `[DEBUG][TIMER]${Math.random().toString(36)} ListFilter.apply`
  ): void {
    const redrawOption = {
      // scriptがある場合はエラー回避のためremoveオプションをOFF
      remove: this.list.querySelector("script") == null,
    };
    redrawOf(this.list, redrawOption)
      .edit((listElement) => {
        console.time(timerName);
        const items = ListFilter.findListItems(listElement);
        console.timeLog(timerName);
        this.clear();
        console.timeLog(timerName);
        items.forEach((item: HTMLElement) => {
          const textContent = item.textContent;
          this.settingList.list.forEach((setting, index) => {
            // 前処理で表示リセット済なのでresetオプションは常にfalse
            this.applyToItem(item, textContent, setting, false);
          });
        });
        console.timeEnd(timerName);
      })
      .show();
  }

  /**
   * リストのフィルターをクリア
   */
  public clear(): void {
    const items = ListFilter.findListItems(this.list);
    items.forEach((item) => {
      this.removeMarkers(item);
    });
    items.forEach((item) => {
      this.removeHighlight(item);
    });
    items.forEach((item: HTMLElement) => {
      this.resetItem(item);
    });
  }

  /**
   * リスト項目を抽出する
   */
  private static findListItems(list: HTMLElement) {
    let items: HTMLElement[];
    if (list.matches(`[data-pseudotype="${PseudoType.list}"]`)) {
      items = querySelectorAllWithDepth(
        list,
        `[data-pseudotype="${PseudoType.listitem}"]`,
        1
      );
    } else {
      const tag = list.tagName.toLowerCase();
      items =
        tag === "table"
          ? querySelectorAllWithDepth<HTMLElement>(list, "tr", 2).filter(
              (tr) => !ListFilter.shouldExcludeTableRow(tr)
            )
          : querySelectorAllWithDepth(list, "li", 1);
    }
    return items;
  }

  /**
   * リストの項目にフィルターを適用
   */
  public applyToItem(
    item: HTMLElement,
    text: string,
    setting: FilterSettingInterface,
    reset: boolean = true
  ) {
    if (!setting.regex && !setting.criterion) {
      return;
    }

    // 元々非表示な要素は無視
    const originallyHidden =
      (item.dataset.ignore ?? null) == null && isDisplayNone(item);
    if (originallyHidden || item.dataset.ignore === "yes") {
      setDataAttr(item, "ignore", "yes");
      return;
    }
    setDataAttr(item, "ignore", "no");

    if (item.classList.contains("listil-hide") || isDisplayNone(item)) {
      // 既に非表示であれば表示の加工しても意味がないのでスキップ
      return;
    }

    // 表示リセット
    reset && this.resetItem(item);

    let match = null;
    if (setting.regex) {
      match = text.match(setting.regex) !== null;
    }
    const elementMatchedCriterion = (() => {
      if (!setting.criterion) {
        return undefined;
      }
      const criterion = new CriterionFactory().create(setting.criterion);
      const matchedElement = criterion.findIn(item);
      return matchedElement;
    })();
    if (setting.criterion) {
      match = !!elementMatchedCriterion;
    }
    if (!match) {
      const formElements = extractValidFormElements(item, true);
      const formValueMatch = Array.from(formElements).some(
        ([key, formElement]) => {
          return (
            setting.regex && formElement.value?.match(setting.regex) !== null
          );
        }
      );
      match = formValueMatch;
    }
    if (!match) {
      const attributeMaps = extractAttributeMaps(item);
      const attributeMatch = attributeMaps.some((attributeMap) => {
        return Array.from(attributeMap).some(([key, attribute]) => {
          return setting.regex && attribute.match(setting.regex) !== null;
        });
      });
      match = attributeMatch;
    }
    const regexOrCriterion = setting.regex || setting.criterion;
    const isMatchedTarget = regexOrCriterion
      ? !setting.invertMatch
        ? match
        : !match
      : false;
    const isNotMatchedTarget = regexOrCriterion
      ? !setting.invertMatch
        ? !match
        : match
      : false;

    if (isMatchedTarget) {
      if (setting.highlight) {
        this.applyHighlight(item);
      }
      if (setting.marker && elementMatchedCriterion) {
        addCssClass(elementMatchedCriterion, "listil-critorion-matched");
        addCssClass(elementMatchedCriterion, setting.markerColor);
      }
      if (setting.marker) {
        // NOTE : DOM構造が変化するフィルタはマーカーより前で行う必要あり。マーカー後にDOM構造が変化するとマーカーが正常に描画されない
        this.applyMarkers(item, setting, setting.markerColor);
      }
    }
    if (isNotMatchedTarget) {
      if (setting.marker && elementMatchedCriterion) {
        addCssClass(elementMatchedCriterion, "listil-critorion-matched");
        addCssClass(elementMatchedCriterion, setting.invertMarkerColor);
      }
      if (setting.grayOut) {
        addCssClass(item, "listil-grayout");
      }
      if (setting.hide) {
        addCssClass(item, "listil-hide");
      }
      if (setting.narrow) {
        this.applyNarrow(item);
      }
      if (setting.marker) {
        this.applyMarkers(item, setting, setting.invertMarkerColor);
      }
    }
  }

  public resetItem(item: HTMLElement) {
    // trの高さ制限用ラッパーを削除
    if (
      item.classList.contains("listil-narrow") &&
      item.tagName.toLowerCase() === "tr"
    ) {
      // (tr > td > *)なので最大2階層
      querySelectorAllWithDepth(item, ".listil-td-inner", 2).forEach(
        (tdInner) => {
          const parent = tdInner.parentNode;
          if (!parent) {
            return;
          }
          while (tdInner.firstChild) {
            parent.insertBefore(tdInner.firstChild, tdInner);
          }
          parent.removeChild(tdInner);
        }
      );
    }
    item.classList.remove("listil-grayout", "listil-hide", "listil-narrow");
  }

  /**
   * 高さ制限を適用
   */
  private applyNarrow(item: HTMLElement) {
    if (item.classList.contains("listil-narrow")) {
      return;
    }
    addCssClass(item, "listil-narrow");
    // trの高さ制限
    if (item.tagName.toLowerCase() === "tr") {
      Array.from(item.children).forEach((trChild) => {
        if (trChild.tagName.toLowerCase() !== "td") {
          return;
        }
        if (trChild.classList.contains("listil-td-inner")) {
          return;
        }
        const tdInner = document.createElement("div");
        tdInner.className = "listil-td-inner";
        while (trChild.firstChild) {
          tdInner.appendChild(trChild.firstChild);
        }
        trChild.appendChild(tdInner);
      });
    }
  }

  /**
   * 指定された <tr> 要素が除外対象であるかを判定する
   *
   * 以下の条件に該当する場合、true を返す（＝除外）：
   * - <thead> または <tfoot> 内にある
   * - 子要素に <td> を1つも含まない
   * @param tr 対象の <tr> 要素
   * @returns boolean 除外すべき場合 true、そうでなければ false
   */
  private static shouldExcludeTableRow(tr: HTMLElement): boolean {
    if (
      tr.closest("thead") ||
      tr.closest("tfoot") ||
      querySelectorAllWithDepth(tr, "td", 1).length <= 0
    ) {
      return true;
    }
    return false;
  }

  /**
   * マーカーを適用
   */
  private applyMarkers(
    element: HTMLElement,
    setting: FilterSettingInterface,
    className: string = "listil-custom-mark"
  ): void {
    addCssClass(element, "listil-has-marker");
    const instance = MarkLite.create(element, {
      crossNode: false,
      proven: false,
    });
    if (setting.regex) {
      instance.markRegExp(setting.regex, {
        className: className,
      });
    }
  }

  /**
   * マーカーを削除
   */
  private removeMarkers(element: HTMLElement): void {
    if (!this.listSettingId) return;

    if (element.classList.contains("listil-has-marker")) {
      const instance = MarkLite.create(element, {
        crossNode: false,
        proven: false,
      });
      instance.unmark();
    }

    // 特殊条件のマーカー用
    element.querySelectorAll(".listil-critorion-matched").forEach((el) => {
      el.classList.remove(
        "listil-critorion-matched",
        "listil-custom-mark-red",
        "listil-custom-mark-yellow",
        "listil-custom-mark-green",
        "listil-custom-mark-cyan",
        "listil-custom-mark-blue",
        "listil-custom-mark-purple"
      );
    });
  }

  /**
   * ハイライトを適用
   */
  private applyHighlight(element: HTMLElement): void {
    // 枠線を追加
    addCssClass(element, "listil-highlight-item");
  }

  /**
   * ハイライトを削除
   */
  private removeHighlight(element: HTMLElement): void {
    if (!this.listSettingId) return;
    if (!element.classList.contains("listil-highlight-item")) {
      return;
    }
    element.classList.remove("listil-highlight-item");
  }
}
