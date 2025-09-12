import { controlsRoot } from "@/Content/Views/controlsRoot";
import { listilModal } from "@/Content/Views/listilModal";
import { listilModalSettingEditor } from "@/Content/Views/listilModalSettingEditor";
import { CriterionFactory } from "@/Criteria/CriterionFactory";
import { addCssClass } from "@/Dom/addCssClass";
import { createElementByHtml } from "@/Dom/createElementByHtml";
import { extractAttributeMaps } from "@/Dom/extractAttributeMaps";
import { extractValidFormElements } from "@/Dom/extractValidFormElements";
import { getElementsByChildCount } from "@/Dom/getElementsByChildCount";
import { isDisplayNone } from "@/Dom/isDisplayNone";
import { MarkLite } from "@/Dom/MarkLite";
import { querySelectorAllWithDepth } from "@/Dom/querySelectorAllWithDepth";
import { redrawOf } from "@/Dom/redrawOf";
import { setDataAttr } from "@/Dom/setDataAttr";
import { GlobalSettingManager } from "@/GlobalSetting/GlobalSettingManager";
import { HtmlElementSummary } from "@/List/HtmlElementSummary";
import { PageSettingManager } from "@/PageSetting/PageSettingManager";
import Mark from "mark.js";
import { findAncestorWithId } from "./Dom/findAncestorWithId";

console.log("[DEBUG] Content script loaded (mark.js version)");

const PseudoType = {
  list: "list",
  listitem: "listitem",
} as const;

/**
 * フィルタ設定インタフェース
 */
interface FilterSettingInterface {
  regex: RegExp | null;
  criterion: string;
  marker: boolean;
  highlight: boolean;
  grayOut: boolean;
  hide: boolean;
  invertMatch: boolean;
  narrow: boolean;
}

/**
 * フィルタ設定インタフェース(シリアライズド)
 */
interface SerializedFilterSettingInterface {
  regexSource: string | null;
  regexFlags: string | null;
  criterion: string;
  marker: boolean;
  highlight: boolean;
  grayOut: boolean;
  hide: boolean;
  invertMatch: boolean;
  narrow: boolean;
}

// 初期デフォルト設定
const defaultSetting: FilterSettingInterface = {
  regex: null,
  criterion: "",
  marker: true,
  highlight: false,
  grayOut: false,
  hide: false,
  invertMatch: false,
  narrow: false,
};

interface FilterSettingList<
  T extends
    | FilterSettingInterface
    | SerializedFilterSettingInterface = FilterSettingInterface
> {
  name?: string;
  list: T[];
}

/**
 * フィルタ設定セット
 */
type FilterSettingSet<
  T extends
    | FilterSettingInterface
    | SerializedFilterSettingInterface = FilterSettingInterface
> = {
  [key: string]: FilterSettingList<T>;
};

/**
 * リスト設定インタフェース
 */
interface ListSettingInterface<
  T extends
    | FilterSettingInterface
    | SerializedFilterSettingInterface = FilterSettingInterface
> {
  name?: string;
  filterSettingSet: FilterSettingSet<T>;
}

/**
 * スタイル追加（mark.js用、表示制御用）
 */
function injectStyles(): void {
  const style = document.createElement("style");
  // NOTE : 基本的にcssファイルにスタイルを設定
  style.textContent = `
  `;
  document.head.appendChild(style);
}

/**
 * コンテンツの領域を検索する
 */
function findContentContainers(): Element[] {
  const seen = new Set<Element>();
  const result: Element[] = [];
  const contentSelectors = ["main", '[id="main"]', '[id="content"]'];
  for (const sel of contentSelectors) {
    // NOTE : 処理が重たいので該当するものが1つ見つかれば他はスキップ
    if (result.length > 0) {
      break;
    }
    // document.querySelectorAll(sel).forEach(el => {
    //   if (!seen.has(el)) {
    //     seen.add(el);
    //     result.push(el);
    //   }
    // });
    const el = document.querySelector(sel);
    if (el && !seen.has(el)) {
      seen.add(el);
      result.push(el);
    }
  }
  if (result.length === 0) {
    result.push(document.body);
  }
  return result;
}

/**
 * リストの検索処理
 */
class ListFinder {
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

/**
 * リストフィルター
 */
class ListFilter {
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
  public apply(): void {
    redrawOf(this.list)
      .edit((listElement) => {
        console.time("ListFilter.apply()");
        const items = ListFilter.findListItems(listElement);
        console.timeLog("ListFilter.apply()");
        this.clear();
        console.timeLog("ListFilter.apply()");
        items.forEach((item: HTMLElement) => {
          this.settingList.list.forEach((setting, index) => {
            // 前処理で表示リセット済なのでresetオプションは常にfalse
            this.applyToItem(item, setting, false);
          });
        });
        console.timeEnd("ListFilter.apply()");
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
    const text: string = item.textContent;
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
      if (setting.marker) {
        this.applyMarkers(item, setting, "listil-custom-mark-yellow");
      }
      if (setting.highlight) {
        this.applyHighlight(item);
      }
      if (setting.marker && elementMatchedCriterion) {
        addCssClass(elementMatchedCriterion, "listil-critorion-matched");
        addCssClass(elementMatchedCriterion, "listil-custom-mark-yellow");
      }
    }
    if (isNotMatchedTarget) {
      if (setting.marker) {
        this.applyMarkers(item, setting, "listil-custom-mark-purple");
      }
      if (setting.marker && elementMatchedCriterion) {
        addCssClass(elementMatchedCriterion, "listil-critorion-matched");
        addCssClass(elementMatchedCriterion, "listil-custom-mark-purple");
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
    //const instance = new Mark(element);
    const instance = new MarkLite(element);
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
      //const instance = new Mark(element);
      const instance = new MarkLite(element);
      instance.unmark();
    }

    // 特殊条件のマーカー用
    element.querySelectorAll(".listil-critorion-matched").forEach((el) => {
      el.classList.remove(
        "listil-critorion-matched",
        "listil-custom-mark-yellow",
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

/**
 * アドバンスド設定モーダル
 */
class AdvancedSettingsModal {
  private listSetting: ListSettingInterface;
  private currentKey: string;
  private modal: HTMLDivElement;
  private onchange: (
    settingList: FilterSettingList,
    currentKey: string
  ) => void;

  constructor(
    listSetting: ListSettingInterface,
    currentKey: string,
    onchange: (settingList: FilterSettingList, currentKey: string) => void
  ) {
    this.listSetting = listSetting;
    this.currentKey = currentKey;
    this.modal = this.createModal();
    this.onchange = onchange;
  }

  private currentSettingList(): FilterSettingList {
    return this.listSetting.filterSettingSet[this.currentKey];
  }

  public open(): void {
    document.body.appendChild(this.modal);
  }

  private createModal(): HTMLDivElement {
    const modal = listilModal();

    const overlay = modal.querySelector<HTMLDivElement>(
      '[data-name="listil-overlay"]'
    )!;
    overlay.addEventListener("click", () => this.close());

    // ▼ 設定切り替え用セレクトボックス
    const settingSelect = modal.querySelector<HTMLSelectElement>(
      'select[name="setting-select"]'
    )!;
    for (const key in this.listSetting.filterSettingSet) {
      const option = document.createElement("option");
      option.value = key;
      option.text = this.listSetting.filterSettingSet[key].name ?? "";
      settingSelect.appendChild(option);
    }
    settingSelect.value = this.currentKey;
    settingSelect.addEventListener("change", () => {
      this.currentKey = settingSelect.value;
      const newModal = this.createModal();
      this.modal.replaceWith(newModal);
      this.modal = newModal;
      this.onchange(this.currentSettingList(), this.currentKey);
    });

    // ▼ 設定名の変更フィールド
    const nameInput = modal.querySelector<HTMLInputElement>(
      '[name="setting-name"]'
    )!;
    nameInput.value = this.currentSettingList().name ?? "";
    nameInput.addEventListener("change", (e) => {
      this.currentSettingList().name = nameInput.value;
      const newModal = this.createModal();
      this.modal.replaceWith(newModal);
      this.modal = newModal;
      this.onchange(this.currentSettingList(), this.currentKey);
    });

    // ▼ 追加ボタン
    const addButton = modal.querySelector<HTMLButtonElement>(
      'button[name="add-setting"]'
    )!;
    addButton.addEventListener("click", () => {
      const newKey = `setting_${Date.now()}`;
      const newFilterSettingList: FilterSettingList = {
        name: (this.currentSettingList().name ?? "") + " (Copy)",
        list: this.currentSettingList().list.map((filterSetting) => {
          return Object.assign({}, filterSetting);
        }),
      };
      this.listSetting.filterSettingSet[newKey] = newFilterSettingList;
      this.currentKey = newKey;
      const newModal = this.createModal();
      this.modal.replaceWith(newModal);
      this.modal = newModal;
      this.onchange(this.currentSettingList(), this.currentKey);
    });

    const listWrapper = modal.querySelector(
      '[data-name="listil-setting-list"]'
    )!;

    this.currentSettingList().list.forEach((setting, index) => {
      const item = this.createSettingEditor(setting, index);
      listWrapper.appendChild(item);
    });

    const addBtn = modal.querySelector<HTMLButtonElement>(
      'button[name="add-filter"]'
    )!;
    addBtn.addEventListener("click", () => {
      const newSetting = { ...defaultSetting };
      this.currentSettingList().list.push(newSetting);
      const item = this.createSettingEditor(
        newSetting,
        this.currentSettingList().list.length - 1
      );
      listWrapper.appendChild(item);
    });

    const closeBtn = modal.querySelector<HTMLButtonElement>(
      'button[name="close"]'
    )!;
    closeBtn.addEventListener("click", () => this.close());

    return modal;
  }

  private createSettingEditor(
    setting: FilterSettingInterface,
    index: number
  ): HTMLElement {
    const wrapper = listilModalSettingEditor();

    const title = wrapper.querySelector('[data-name="setting-no"]')!;
    title.textContent = `#${index + 1}`;

    const input = wrapper.querySelector<HTMLInputElement>(
      'input[name="listil-pattern-input"]'
    )!;
    input.value = setting.regex?.source ?? setting.criterion;

    // エラーメッセージ表示用
    const errorMessage = wrapper.querySelector<HTMLSpanElement>(
      '[data-name="listil-pattern-error"]'
    )!;
    errorMessage.style.display = "none";

    input.addEventListener("change", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const str = input.value.trim();
      if (str === "") {
        setting.regex = null;
        setting.criterion = "";
        input.style.borderColor = ""; // 通常の枠に戻す
        errorMessage.style.display = "none";
        this.onchange(this.currentSettingList(), this.currentKey);
        return;
      }
      if (str.charAt(0) === "*") {
        setting.regex = null;
        setting.criterion = str;
        // 正常な場合：装飾をリセット
        input.style.borderColor = "";
        errorMessage.style.display = "none";
        this.onchange(this.currentSettingList(), this.currentKey);
        return;
      }
      try {
        setting.regex = new RegExp(str, "i");
        setting.criterion = "";
        // 正常な場合：装飾をリセット
        input.style.borderColor = "";
        errorMessage.style.display = "none";
        this.onchange(this.currentSettingList(), this.currentKey);
        return;
      } catch (err) {
        // エラーの場合：赤枠＋エラーメッセージ
        setting.regex = null;
        setting.criterion = "";
        input.style.borderColor = "red";
        errorMessage.style.display = "inline";
        return;
      }
    });

    const invertCheckbox = wrapper.querySelector<HTMLInputElement>(
      'input[name="invert-matching"]'
    )!;
    invertCheckbox.checked = setting.invertMatch ?? false;
    invertCheckbox.addEventListener("change", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      setting.invertMatch = invertCheckbox.checked;
      this.onchange(this.currentSettingList(), this.currentKey);
    });

    const controlFactory = new ControlFactory();
    const markerCheckbox = wrapper.querySelector<HTMLInputElement>(
      'input[name="marker"]'
    )!;
    controlFactory.initCheckbox(markerCheckbox, setting.marker, (checked) => {
      setting.marker = checked;
      this.onchange(this.currentSettingList(), this.currentKey);
    });

    const highlightCheckbox = wrapper.querySelector<HTMLInputElement>(
      'input[name="highlight"]'
    )!;
    controlFactory.initCheckbox(
      highlightCheckbox,
      setting.highlight,
      (checked) => {
        setting.highlight = checked;
        this.onchange(this.currentSettingList(), this.currentKey);
      }
    );

    const grayOutCheckbox = wrapper.querySelector<HTMLInputElement>(
      'input[name="grayout-others"]'
    )!;
    controlFactory.initCheckbox(grayOutCheckbox, setting.grayOut, (checked) => {
      setting.grayOut = checked;
      this.onchange(this.currentSettingList(), this.currentKey);
    });

    const narrowCheckbox = wrapper.querySelector<HTMLInputElement>(
      'input[name="narrow-others"]'
    )!;
    controlFactory.initCheckbox(narrowCheckbox, setting.narrow, (checked) => {
      setting.narrow = checked;
      this.onchange(this.currentSettingList(), this.currentKey);
    });

    const hidecheckbox = wrapper.querySelector<HTMLInputElement>(
      'input[name="hide-others"]'
    )!;
    controlFactory.initCheckbox(hidecheckbox, setting.hide, (checked) => {
      setting.hide = checked;
      this.onchange(this.currentSettingList(), this.currentKey);
    });

    const removeBtn = wrapper.querySelector<HTMLButtonElement>(
      'button[name="remove-filter"]'
    )!;
    removeBtn.addEventListener("click", () => {
      if (this.currentSettingList().list.length <= 1) {
        alert("2件以上ある場合のみ削除できます。");
        return;
      }
      this.currentSettingList().list.splice(index, 1);
      this.onchange(this.currentSettingList(), this.currentKey);
      this.modal.remove(); // 再生成
      this.modal = this.createModal();
      this.open();
    });

    return wrapper;
  }

  private close(): void {
    this.modal.remove();
  }
}

class ControlFactory {
  /**
   * チェックボックス初期化
   */
  public initCheckbox(
    checkbox: HTMLInputElement,
    checked: boolean,
    onChange: (checked: boolean) => void
  ): void {
    checkbox.checked = checked;
    checkbox.addEventListener("change", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      onChange(checkbox.checked);
    });
  }

  /**
   * コントロール UI 作成
   *
   * @param list
   * @param settingList
   */
  public createFilterControls(
    list: HTMLElement,
    listSetting: ListSettingInterface<FilterSettingInterface>
  ): HTMLElement {
    let currentKey = "setting1";
    // [x] TODO : settingとsettingListの2つあるのは冗長なので整理する
    if (listSetting.filterSettingSet[currentKey].list.length <= 0) {
      throw new Error("Violation. The settingList is Empty.");
    }
    const setting = listSetting.filterSettingSet[currentKey].list[0];

    const wrapper = createElementByHtml(/*html*/ `
      <div class="listil-controls">
        <fieldset class="listil-fieldset">
          <div class="listil-top-row">
            <input name="listil-pattern-input"
              form="not-exists"
              placeholder="正規表現を入力..."
              class="listil-regex-input"
              style="margin-right: 10px;">
            <span data-name="listil-pattern-error"
              class="listil-validation-error" style="display: none;">
                無効な正規表現です
            </span>
            <label style="margin-right:8px;">
              <input type="checkbox" name="invert-matching"
                form="not-exists"
                class="listil-checkbox"
                style="margin-right:4px;">
              invert matching
            </label>
            <button type="button" name="listil-save-button"
              form="not-exists"
              style="margin-left:10px;">
              Save
            </button>
            <select name="listil-setting-select" form="not-exists"></select>
          </div>
          <label style="margin-right:8px;">
            <input type="checkbox" name="marker"
              form="not-exists"
              class="listil-checkbox"
              style="margin-right:4px;">
            Marker
          </label>
          <label style="margin-right:8px;">
            <input type="checkbox" name="highlight"
              form="not-exists"
              class="listil-checkbox"
              style="margin-right:4px;">
            Highlight
          </label>
          <label style="margin-right:8px;">
            <input type="checkbox" name="grayout-others"
              form="not-exists"
              class="listil-checkbox"
              style="margin-right:4px;">
            GrayOut others
          </label>
          <label style="margin-right:8px;">
            <input type="checkbox" name="narrow-others"
              form="not-exists"
              class="listil-checkbox"
              style="margin-right:4px;">
            Narrow others
          </label>
          <label style="margin-right:8px;">
            <input type="checkbox" name="hide-others"
              form="not-exists"
              class="listil-checkbox"
              style="margin-right:4px;">
            Hide others
          </label>
        </fieldset>
        <button type="button" name="listil-advanced-button"
          form="not-exists"
          style="margin-left:10px;">
          Advanced
        </button>
      </div>
    `);

    // [ ] TODO criterionも対象にする
    // 正規表現入力
    const input = wrapper.querySelector<HTMLInputElement>(
      'input[name="listil-pattern-input"]'
    )!;
    input.value = setting.regex?.source ?? setting.criterion;

    // エラーメッセージ表示用
    const errorMessage = wrapper.querySelector<HTMLSpanElement>(
      '[data-name="listil-pattern-error"]'
    )!;
    errorMessage.style.display = "none"; // 初期状態は非表示

    input.addEventListener("change", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const str = input.value.trim();
      if (str === "") {
        currentFirstSetting().regex = null;
        currentFirstSetting().criterion = "";
        input.style.borderColor = ""; // 通常の枠に戻す
        errorMessage.style.display = "none";
        new ListFilter(list, currentSetting()).apply();
        return;
      }

      if (str.charAt(0) === "*") {
        currentFirstSetting().regex = null;
        currentFirstSetting().criterion = str;
        // 正常な場合：装飾をリセット
        input.style.borderColor = "";
        errorMessage.style.display = "none";
        new ListFilter(list, currentSetting()).apply();
        return;
      }
      try {
        currentFirstSetting().regex = new RegExp(str, "i");
        currentFirstSetting().criterion = "";
        // 正常な場合：装飾をリセット
        input.style.borderColor = "";
        errorMessage.style.display = "none";
        new ListFilter(list, currentSetting()).apply();
        return;
      } catch (err) {
        // エラーの場合：赤枠＋エラーメッセージ
        currentFirstSetting().regex = null;
        currentFirstSetting().criterion = "";
        input.style.borderColor = "red";
        errorMessage.style.display = "inline";
        return;
      }
    });

    // マッチモードラジオボタン群
    const invertBox = wrapper.querySelector<HTMLInputElement>(
      'input[name="invert-matching"]'
    )!;
    invertBox.checked = setting.invertMatch;
    invertBox.addEventListener("change", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      currentFirstSetting().invertMatch = invertBox.checked;
      new ListFilter(list, currentSetting()).apply();
    });

    const saveButton = wrapper.querySelector<HTMLButtonElement>(
      '[name="listil-save-button"]'
    )!;
    saveButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      new ListSettingRepository().save(createStorageKey(list.id), listSetting);
    });

    const settingSelect = wrapper.querySelector<HTMLSelectElement>(
      '[name="listil-setting-select"]'
    )!;
    for (const key in listSetting.filterSettingSet) {
      const option = document.createElement("option");
      option.value = key;
      option.text = listSetting.filterSettingSet[key].name || key;
      settingSelect.appendChild(option);
    }
    settingSelect.value = currentKey;
    settingSelect.addEventListener("change", () => {
      currentKey = settingSelect.value;
      const newSetting = listSetting.filterSettingSet[currentKey];
      console.log("DEBUG", currentKey, newSetting);
      new ListFilter(list, newSetting).apply();
      refreshBasicControls(newSetting.list[0], currentKey);
    });
    const currentSetting = () => {
      return listSetting.filterSettingSet[settingSelect.value];
    };
    const currentFirstSetting = () => {
      return currentSetting().list[0];
    };

    // 他のチェックボックスはそのまま
    const markerBox = wrapper.querySelector<HTMLInputElement>(
      'input[name="marker"]'
    )!;
    this.initCheckbox(markerBox, setting.marker, (state) => {
      currentFirstSetting().marker = state;
      new ListFilter(list, currentSetting()).apply();
    });

    const highlightBox = wrapper.querySelector<HTMLInputElement>(
      'input[name="highlight"]'
    )!;
    this.initCheckbox(highlightBox, setting.highlight, (state) => {
      currentFirstSetting().highlight = state;
      new ListFilter(list, currentSetting()).apply();
    });

    const grayOutBox = wrapper.querySelector<HTMLInputElement>(
      'input[name="grayout-others"]'
    )!;
    this.initCheckbox(grayOutBox, setting.grayOut, (state) => {
      currentFirstSetting().grayOut = state;
      new ListFilter(list, currentSetting()).apply();
    });

    const narrowBox = wrapper.querySelector<HTMLInputElement>(
      'input[name="narrow-others"]'
    )!;
    this.initCheckbox(narrowBox, setting.narrow, (state) => {
      currentFirstSetting().narrow = state;
      new ListFilter(list, currentSetting()).apply();
    });

    const hideBox = wrapper.querySelector<HTMLInputElement>(
      'input[name="hide-others"]'
    )!;
    this.initCheckbox(hideBox, setting.hide, (state) => {
      currentFirstSetting().hide = state;
      new ListFilter(list, currentSetting()).apply();
    });

    const advancedBtn = wrapper.querySelector(
      '[name="listil-advanced-button"]'
    )!;
    advancedBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      new AdvancedSettingsModal(
        listSetting,
        currentKey,
        (newSettingList, newCurrentKey) => {
          new ListFilter(list, newSettingList).apply();
          if (newSettingList.list.length <= 0) {
            throw new Error("Violation. The settingList is Empty.");
          }
          // 基本コントロールの状態を更新
          refreshBasicControls(newSettingList.list[0], newCurrentKey);
        }
      ).open();
    });

    return wrapper;

    /**
     * 基本コントロール群の表示をリフレッシュ
     */
    function refreshBasicControls(
      firstSetting: FilterSettingInterface,
      newCurrentKey: string
    ) {
      // [x] TODO criterionも対象にする
      input.value = firstSetting.regex?.source ?? firstSetting.criterion;
      settingSelect.length = 0;
      for (const key in listSetting.filterSettingSet) {
        const option = document.createElement("option");
        option.value = key;
        option.text = listSetting.filterSettingSet[key].name || key;
        settingSelect.appendChild(option);
      }
      settingSelect.value = newCurrentKey;
      (invertBox as HTMLInputElement).checked = firstSetting.invertMatch;
      (markerBox as HTMLInputElement).checked = firstSetting.marker;
      (highlightBox as HTMLInputElement).checked = firstSetting.highlight;
      (grayOutBox as HTMLInputElement).checked = firstSetting.grayOut;
      (narrowBox as HTMLInputElement).checked = firstSetting.narrow;
      (hideBox as HTMLInputElement).checked = firstSetting.hide;
    }
  }
}

/**
 * 実質リストにlist/listitemの識別タグを付加
 *
 * @param root - 探索の起点となるルート要素（デフォルトは document.body）
 */
function addPseudoType(root: Element = document.body): void {
  // 子要素要素数で評価
  const exclude = [
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
  const elementsWithManyChildren = getElementsByChildCount(root, 20, exclude);
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

/**
 * idを付加する。既にidがある場合はスキップ。
 */
function assignIdToListElements(root: Element = document.body) {
  const targets = root.querySelectorAll<HTMLElement>(
    `ul, ol, table, [data-pseudotype="${PseudoType.list}"]`
  );
  const groupCounters = new Map<string, number>();
  targets.forEach((el) => {
    if (el.id) {
      return;
    }
    // 最も近い id を持つ祖先要素を探す
    const ancestor = findAncestorWithId(el);
    const ancestorId = ancestor ? ancestor.id : undefined;
    el.setAttribute("data-listil-group", ancestorId ?? "");
    // group 用に連番管理
    const groupPrefix = `listil-${ancestorId ?? ""}`;
    const count = groupCounters.get(groupPrefix) ?? 0;
    const newId = `${groupPrefix}-list-${count}`;
    groupCounters.set(groupPrefix, count + 1);
    // idを設定
    el.id = newId;
  });
}

const SavePrefix = {
  global: "global:",
  listSettings: "listSettings:",
};

/**
 * 保存キー生成
 */
function createStorageKey(
  listId: string,
  _url: string = location.href
): string {
  const wkUrl = SavePrefix.listSettings + location.href.replace(/[#?].*$/, "");
  return `${wkUrl}#${listId}`;
}

class ListSettingRepository {
  /**
   * 保存
   */
  public save(key: string, setting: ListSettingInterface): void {
    const serialized = this.serializeListSetting(setting);
    chrome.storage.local.set({ [key]: serialized }, () => {
      console.log(`[listil] Saved list setting for ${key}`);
    });
  }

  /**
   * 復元
   */
  public async restore(key: string): Promise<ListSettingInterface | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (result[key]) {
          try {
            const deserialized = this.deserializeListSetting(result[key]);
            resolve(deserialized);
          } catch (e) {
            // デシリアライズ失敗
            console.warn("[Listil] 保存データのデシリアライズ失敗", e);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * 設定のシリアライズ（ListSettingInterface → JSON）
   */
  private serializeListSetting(
    setting: ListSettingInterface
  ): ListSettingInterface<SerializedFilterSettingInterface> {
    const serializedFilterSettingSet: FilterSettingSet<SerializedFilterSettingInterface> =
      {};
    for (const key in setting.filterSettingSet) {
      serializedFilterSettingSet[key] = {
        name: setting.filterSettingSet[key].name ?? undefined,
        list: setting.filterSettingSet[key].list.map(
          this.serializeFilterSetting
        ),
      };
    }
    return {
      name: setting.name,
      filterSettingSet: serializedFilterSettingSet,
    };
  }

  /**
   * 設定のデシリアライズ（JSON → ListSettingInterface）
   */
  private deserializeListSetting(
    serialized: ListSettingInterface<SerializedFilterSettingInterface>
  ): ListSettingInterface {
    const deserializedFilterSettingSet: FilterSettingSet = {};
    for (const key in serialized.filterSettingSet) {
      const filterSetting = serialized.filterSettingSet[key];
      deserializedFilterSettingSet[key] = {
        name: filterSetting.name ?? undefined,
        list: Array.isArray(filterSetting.list)
          ? filterSetting.list.map(this.deserializeFilterSetting)
          : [],
      };
    }
    return {
      name: serialized.name,
      filterSettingSet: deserializedFilterSettingSet,
    };
  }

  /**
   * 個別フィルタ設定のシリアライズ
   */
  private serializeFilterSetting(
    setting: FilterSettingInterface
  ): SerializedFilterSettingInterface {
    // [x] TODO criterionも対象にする
    return {
      regexSource: setting.regex ? setting.regex.source : null,
      regexFlags: setting.regex ? setting.regex.flags : null,
      criterion: setting.criterion,
      marker: setting.marker,
      highlight: setting.highlight,
      grayOut: setting.grayOut,
      hide: setting.hide,
      invertMatch: setting.invertMatch,
      narrow: setting.narrow,
    };
  }

  /**
   * 個別フィルタ設定のデシリアライズ
   */
  private deserializeFilterSetting(
    serialized: SerializedFilterSettingInterface
  ): FilterSettingInterface {
    let regex: RegExp | null = null;
    try {
      if (serialized.regexSource && serialized.regexFlags !== null) {
        regex = new RegExp(serialized.regexSource, serialized.regexFlags);
      }
    } catch (e) {
      console.error("[listil] 正規表現の復元に失敗しました", e);
      throw e;
    }
    // [x] TODO criterionも対象にする
    return {
      regex,
      criterion: serialized.criterion,
      marker: serialized.marker,
      highlight: serialized.highlight,
      grayOut: serialized.grayOut,
      hide: serialized.hide,
      invertMatch: serialized.invertMatch,
      narrow: serialized.narrow,
    };
  }
}

const listSettings = new Map<
  string,
  ListSettingInterface<FilterSettingInterface>
>();

/**
 * トグルボタンとUI追加
 */
function addListilControlsToLists(skipReload: boolean = false): void {
  const timerName = "[DEBUG] addListilControlsToLists";
  console.time(timerName);
  injectStyles();
  console.timeLog(timerName);
  const contentContainers = findContentContainers();
  contentContainers.forEach((container) => {
    addPseudoType(container);
  });
  contentContainers.forEach((container) => {
    assignIdToListElements(container);
  });
  console.timeLog(timerName);
  const finder = new ListFinder(contentContainers);
  const lists = finder.findLists();
  console.timeLog(timerName);

  lists.forEach(async (list: HTMLElement, index: number) => {
    const listSettingId = `list-${index}`;
    list.dataset.listSettingId = listSettingId;

    // listSettingsに設定がなければデータを追加。リロードはオプション次第
    const key = createStorageKey(list.id);
    if (listSettings.get(key) == null || !skipReload) {
      // ストレージから復元。0件であればデフォルト設定を使う。
      const wkListSetting = (await new ListSettingRepository().restore(
        key
      )) ?? {
        name: "xxxxx",
        filterSettingSet: {
          setting1: {
            name: "setting1",
            list: [defaultSetting],
          },
        },
      };
      listSettings.set(key, wkListSetting);
    }
    const listSetting = listSettings.get(key);
    if (listSetting == null) {
      throw new Error("the listSetting is undefined.");
    }
    const restoredSettingList = listSetting?.filterSettingSet["setting1"];
    restoredSettingList.list = (
      restoredSettingList.list.length > 0
        ? restoredSettingList.list
        : [defaultSetting]
    ).map((setting) => {
      // データ仕様変更を考慮してデフォルト設定とマージ
      return { ...defaultSetting, ...setting };
    });
    console.log(`[DEBUG]`, `Loaded setting`, restoredSettingList);

    const rootDiv = controlsRoot();

    const controls = new ControlFactory().createFilterControls(
      list,
      listSetting
    );
    controls.style.display = "none";
    rootDiv.appendChild(controls);

    let listVisible = true;
    const toggleListBtn = rootDiv.querySelector(
      '[name="listil-showhide-toggle"]'
    )!;
    toggleListBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      listVisible = !listVisible;
      list.style.display = listVisible ? "" : "none";
      toggleListBtn.textContent = listVisible ? "Hide List" : "Show List";
    });

    let controlsVisible = false;
    const toggleControlsBtn = rootDiv.querySelector(
      '[name="listil-onoff-toggle"]'
    )!;
    toggleControlsBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      controlsVisible = !controlsVisible;
      controls.style.display = controlsVisible ? "" : "none";
      toggleControlsBtn.textContent = controlsVisible
        ? "Hide Controls"
        : "Show Controls";
    });

    const parentOfList = list.parentNode!;
    parentOfList.insertBefore(rootDiv, list);

    // リストのフィルターを適用
    new ListFilter(list, restoredSettingList).apply();
  });
  console.timeEnd(timerName);
}

/**
 * トグルボタンとUIを削除。フィルタによるスタイルもクリア
 */
function cleanListilControls() {
  const contentContainers = findContentContainers();
  const finder = new ListFinder(contentContainers);
  const lists = finder.findLists();

  lists.forEach(async (list: HTMLElement, index: number) => {
    // リストのスタイルをクリア。クリアのみなのでダミー設定でフィルターを適用
    const dummySettingList = {
      name: "setting1",
      list: [defaultSetting],
    };
    new ListFilter(list, dummySettingList).clear();
  });

  const elements = document.querySelectorAll('[class~="listil-root"]');
  elements.forEach((el) => el.remove());
}

const globalSettingManager = new GlobalSettingManager();
const pageSettingManager = new PageSettingManager();

/**
 * 初期化。設定を読み込み、コントロールを追加する。
 */
async function initialize(skipReload: boolean = false) {
  const globalSetting = await globalSettingManager.load();
  const pageSetting = await pageSettingManager.findByUrl(location.href);
  console.log("DEBUG", "loaded globalSetting: ", globalSetting);
  console.log("DEBUG", "loaded pageSetting: ", pageSetting);
  if (pageSetting?.enabled ?? globalSetting.enabled ?? true) {
    addListilControlsToLists(skipReload);
  }
}

// --- 実行 ---
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initialize());
} else {
  initialize();
}

chrome.runtime.onMessage.addListener(
  (message: { type: string; enabled: boolean }, sender, sendResponse) => {
    // NOTE: 非同期で応答する場合、リスナー内で return true; が必要
    if (message.type === "enabled_changed") {
      if (message.enabled) {
        (async () => {
          await initialize();
          sendResponse({ success: true, data: {} });
        })();
        // 非同期応答のために通信チャネルを維持
        return true;
      } else {
        cleanListilControls();
        sendResponse({ success: true, data: {} });
      }
    }
  }
);

const monitorByMutationObserver = false;
// MutationObserverで再描画を監視 (Reactサイト用)
// NOTE : 試験的機能。今のところ実用的ではない。再描画に合わせてコントロールを再追加することはできているがまだ実用可能とはいえない。
// BUG : フィルタ適用でコントロールが増殖したり、リスト全体が表示されなくなることがある
// NOTE : manifest.jsonで `"run_at": "document_idle"` (Reactの初期レンダリングが完了した後にスクリプトを実行) を設定すること。
monitorByMutationObserver &&
  window.addEventListener("load", () => {
    let cnt = 0;
    document.body.dataset.listilCnt = `${cnt}`;
    const observer = new MutationObserver(async (mutationsList) => {
      let shouldRefresh = false;
      for (const mutation of mutationsList) {
        console.log("DEBUG", "mutation", mutation.target.nodeName, mutation);
        let shouldBreak = false;
        mutation.addedNodes.forEach((node) => {
          console.log("DEBUG", "mutation node", node.nodeName, node);
          if (shouldBreak) {
            return;
          }
          if (!(node instanceof HTMLElement)) {
            return;
          }
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
          }
          if (!(node.firstChild instanceof HTMLElement)) {
            return;
          }
          // 要素およびその子孫が無視条件にマッチするならば無視
          if (node.matches('[class*="listil-"]')) {
            return;
          }
          if (node.querySelector('[class*="listil-"]')) {
            return;
          }
          if (node.querySelector("[data-listil-checked]")) {
            console.log("DEBUG", "This DOM Element has already checked.");
            return;
          }
          node.firstChild.dataset.listilChecked = "checked";
          shouldRefresh = true;
          shouldBreak = true;
        });
      }
      if (shouldRefresh && document.body.dataset.listilCnt === `${cnt}`) {
        cnt++;
        // コントロールを削除
        console.log(
          "DEBUG",
          " DOM change detected. Executing cleanup and re-add controls...",
          cnt
        );
        cleanListilControls();
        // 初期化・コントロールを追加
        await initialize(true);
        document.body.dataset.listilCnt = `${cnt}`;
      }
    });
    observer.observe(document.body, {
      /** 子要素の追加・削除を監視 (true:監視する) */
      childList: true,
      /** その要素の中のすべての子孫（ネストした要素全部）も監視 (true:監視する) */
      subtree: true,
      /** 属性の変更も検知 (true:検知する) */
      attributes: false,
    });
  });
