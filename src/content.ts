import Mark from "mark.js";
import { createElementByHtml } from "./Dom/createElementByHtml";
import { extractAttributeMaps } from "./Dom/extractAttributeMaps";
import { extractValidFormElements } from "./Dom/extractValidFormElements";
import { getContentBoxSize } from "./Dom/getContentBoxSize";
import { querySelectorAllWithDepth } from "./Dom/querySelectorAllWithDepth";
import { GlobalSettingManager } from "./GlobalSetting/GlobalSettingManager";
import { PageSettingManager } from "./PageSetting/PageSettingManager";

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
    console.log("[DEBUG] " + (el.dataset.pseudotype ?? "-"));

    // 対象外の要素配下か
    if (el.closest(this.excludeSelector)) return false;
    if (this.hasExcludedAncestor(el)) return false;

    if (tag === "table") {
      // NOTE : tbodyを挟む場合があるので深さ2を指定
      return querySelectorAllWithDepth(el, "tr", 2).length >= 10;
    } else if (tag === "ul" || tag === "ol") {
      return querySelectorAllWithDepth(el, "li", 1).length >= 10;
    } else if (el.dataset.pseudotype === PseudoType.list) {
      console.log("[DEBUG] pseudo listitem");
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
 * 要素は非表示か否か
 */
function isInvisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  const size = getContentBoxSize(el);
  const invisible =
    style.display === "none" || size.width === 0 || size.height === 0;
  return invisible;
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
    const items = this.findListItems();
    this.clear();

    items.forEach((item: HTMLElement) => {
      this.settingList.list.forEach((setting, index) => {
        // 前処理で表示リセット済なのでresetオプションは常にfalse
        this.applyToItem(item, setting, false);
      });
    });
  }

  /**
   * リストのフィルターをクリア
   */
  public clear(): void {
    const items = this.findListItems();
    this.removeMarkers();
    this.removeHighlights();
    items.forEach((item: HTMLElement) => {
      this.resetItem(item);
    });
  }

  /**
   * リスト項目を抽出する
   */
  private findListItems() {
    let items: HTMLElement[];
    if (this.list.matches(`[data-pseudotype="${PseudoType.list}"]`)) {
      items = querySelectorAllWithDepth(
        this.list,
        `[data-pseudotype="${PseudoType.listitem}"]`,
        1
      );
    } else {
      const tag = this.list.tagName.toLowerCase();
      items =
        tag === "table"
          ? querySelectorAllWithDepth<HTMLElement>(this.list, "tr", 2).filter(
              (tr) => !this.shouldExcludeTableRow(tr)
            )
          : querySelectorAllWithDepth(this.list, "li", 1);
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
    // 元々非表示な要素は無視
    const originallyHidden =
      (item.dataset.ignore ?? null) == null && isInvisible(item);
    if (originallyHidden || item.dataset.ignore === "yes") {
      item.dataset.ignore = "yes";
      return;
    }
    item.dataset.ignore = "no";

    // 表示リセット
    reset && this.resetItem(item);

    const text: string = item.innerText;
    const textMatch = setting.regex && text.match(setting.regex) !== null;
    let match = textMatch;
    if (!match) {
      const formElements = extractValidFormElements(item, true);
      const formValueMatch = Array.from(formElements).some(
        ([key, formElement]) => {
          console.log("DEBUG", "form element value: ", {
            name: key,
            value: formElement.value,
          });
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
        console.log("DEBUG", "element attributes:", attributeMap);
        return Array.from(attributeMap).some(([key, attribute]) => {
          console.log("DEBUG", "element attribute: ", {
            attributeName: key,
            value: attribute,
          });
          return setting.regex && attribute.match(setting.regex) !== null;
        });
      });
      match = attributeMatch;
    }
    const isMatchedTarget = setting.regex
      ? !setting.invertMatch
        ? match
        : !match
      : false;
    const isNotMatchedTarget = setting.regex
      ? !setting.invertMatch
        ? !match
        : match
      : false;

    if (isMatchedTarget) {
      if (setting.marker) {
        this.applyMarkers(item, setting);
      }
      if (setting.highlight) {
        this.applyHighlights(item);
      }
    }
    if (isNotMatchedTarget) {
      if (setting.grayOut) {
        item.classList.add("listil-grayout");
      }
      if (setting.hide) {
        item.classList.add("listil-hide");
      }
      if (setting.narrow) {
        this.applyNarrow(item);
      }
    }
  }

  public resetItem(item: HTMLElement) {
    item.classList.remove("listil-grayout", "listil-hide", "listil-narrow");
    // trの高さ制限用ラッパーを削除
    if (item.tagName.toLowerCase() === "tr") {
      item.querySelectorAll(".listil-td-inner").forEach((tdInner) => {
        const parent = tdInner.parentNode;
        if (!parent) {
          return;
        }
        while (tdInner.firstChild) {
          parent.insertBefore(tdInner.firstChild, tdInner);
        }
        parent.removeChild(tdInner);
      });
    }
  }

  /**
   * 高さ制限を適用
   */
  private applyNarrow(item: HTMLElement) {
    item.classList.add("listil-narrow");
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
  private shouldExcludeTableRow(tr: HTMLElement): boolean {
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
    setting: FilterSettingInterface
  ): void {
    const instance = new Mark(element);
    if (setting.regex) {
      instance.markRegExp(setting.regex, {
        className: "listil-custom-mark",
      });
    }
  }

  /**
   * マーカーを削除
   */
  private removeMarkers(): void {
    if (!this.listSettingId) return;

    const instance = new Mark(this.list);
    instance.unmark();
  }

  /**
   * ハイライトを適用
   */
  private applyHighlights(element: HTMLElement): void {
    // 枠線を追加
    element.classList.add("listil-highlight-item");
  }

  /**
   * ハイライトを削除
   */
  private removeHighlights(): void {
    if (!this.listSettingId) return;
    const items = this.list.querySelectorAll(".listil-highlight-item");
    items.forEach((item) => item.classList.remove("listil-highlight-item"));
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
    const modal = document.createElement("div");
    modal.className = "listil-modal listil-root";

    const overlay = document.createElement("div");
    overlay.className = "listil-overlay";
    overlay.addEventListener("click", () => this.close());

    const content = document.createElement("div");
    content.className = "listil-modal-content";

    const title = document.createElement("h3");
    title.textContent = "Advanced Filter Settings";
    title.className = "listil-modal-title";

    const switchSetting = document.createElement("div");
    // ▼ 設定切り替え用セレクトボックス
    const settingSelect = document.createElement("select");
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
    switchSetting.appendChild(settingSelect);

    // ▼ 設定名の変更フィールド
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = this.currentSettingList().name ?? "";
    nameInput.placeholder = "設定名";
    nameInput.addEventListener("change", (e) => {
      this.currentSettingList().name = nameInput.value;
      const newModal = this.createModal();
      this.modal.replaceWith(newModal);
      this.modal = newModal;
      this.onchange(this.currentSettingList(), this.currentKey);
    });
    switchSetting.appendChild(nameInput);

    // ▼ 追加ボタン
    const addButton = document.createElement("button");
    addButton.textContent = "＋設定をコピー";
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
    switchSetting.appendChild(addButton);

    const listWrapper = document.createElement("div");
    listWrapper.className = "listil-setting-list";

    this.currentSettingList().list.forEach((setting, index) => {
      const item = this.createSettingEditor(setting, index);
      listWrapper.appendChild(item);
    });

    const addBtn = document.createElement("button");
    addBtn.textContent = "＋ Add Filter";
    addBtn.addEventListener("click", () => {
      const newSetting = { ...defaultSetting };
      this.currentSettingList().list.push(newSetting);
      const item = this.createSettingEditor(
        newSetting,
        this.currentSettingList().list.length - 1
      );
      listWrapper.appendChild(item);
    });

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✖ Close";
    closeBtn.addEventListener("click", () => this.close());

    content.appendChild(title);
    content.appendChild(switchSetting);
    content.appendChild(listWrapper);
    content.appendChild(addBtn);
    content.appendChild(closeBtn);
    modal.appendChild(overlay);
    modal.appendChild(content);

    return modal;
  }

  private createSettingEditor(
    setting: FilterSettingInterface,
    index: number
  ): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "listil-setting-editor";

    const title = document.createElement("h4");
    title.textContent = `#${index + 1}`;
    title.className = "listil-modal-setting-no";

    const input = new ControlFactory().createRegexInput(setting.regex);
    input.className = "listil-modal-setting-input";

    // エラーメッセージ表示用
    const errorMessage = document.createElement("span");
    errorMessage.classList.add("listil-validation-error");
    errorMessage.style.display = "none";
    errorMessage.textContent = "無効な正規表現です";

    input.addEventListener("input", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const str = input.value.trim();
      if (str === "") {
        setting.regex = null;
        input.style.borderColor = ""; // 通常の枠に戻す
        errorMessage.style.display = "none";
        this.onchange(this.currentSettingList(), this.currentKey);
        return;
      }
      try {
        setting.regex = new RegExp(str, "gi");
        // 正常な場合：装飾をリセット
        input.style.borderColor = "";
        errorMessage.style.display = "none";
        this.onchange(this.currentSettingList(), this.currentKey);
      } catch (err) {
        // エラーの場合：赤枠＋エラーメッセージ
        setting.regex = null;
        input.style.borderColor = "red";
        errorMessage.style.display = "inline";
      }
    });

    const invertCheckbox = new ControlFactory().createCheckbox(
      "Invert",
      setting.invertMatch ?? false,
      (checked) => {
        setting.invertMatch = checked;
        this.onchange(this.currentSettingList(), this.currentKey);
      }
    );
    const markerCheckbox = new ControlFactory().createCheckbox(
      "Marker",
      setting.marker ?? false,
      (checked) => {
        setting.marker = checked;
        this.onchange(this.currentSettingList(), this.currentKey);
      }
    );
    const highlightCheckbox = new ControlFactory().createCheckbox(
      "Highlight",
      setting.highlight ?? false,
      (checked) => {
        setting.highlight = checked;
        this.onchange(this.currentSettingList(), this.currentKey);
      }
    );
    const grayOutCheckbox = new ControlFactory().createCheckbox(
      "GrayOut other",
      setting.grayOut ?? false,
      (checked) => {
        setting.grayOut = checked;
        this.onchange(this.currentSettingList(), this.currentKey);
      }
    );
    const narrowCheckbox = new ControlFactory().createCheckbox(
      "Narrow other",
      setting.narrow ?? false,
      (checked) => {
        setting.narrow = checked;
        this.onchange(this.currentSettingList(), this.currentKey);
      }
    );
    const hidecheckbox = new ControlFactory().createCheckbox(
      "Hide other",
      setting.hide ?? false,
      (checked) => {
        setting.hide = checked;
        this.onchange(this.currentSettingList(), this.currentKey);
      }
    );

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "🗑";
    removeBtn.title = "Remove this filter";
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

    const topRow = document.createElement("div");
    topRow.style.width = "100%";
    topRow.appendChild(input);
    topRow.appendChild(errorMessage);
    topRow.appendChild(invertCheckbox);

    const fieldset = document.createElement("fieldset");
    fieldset.className = "listil-fieldset";

    fieldset.appendChild(topRow);
    fieldset.appendChild(markerCheckbox);
    fieldset.appendChild(highlightCheckbox);
    fieldset.appendChild(grayOutCheckbox);
    fieldset.appendChild(narrowCheckbox);
    fieldset.appendChild(hidecheckbox);
    fieldset.appendChild(removeBtn);

    wrapper.appendChild(title);
    wrapper.appendChild(fieldset);

    return wrapper;
  }

  private close(): void {
    this.modal.remove();
  }
}

class ControlFactory {
  /**
   * チェックボックス作成
   */
  public createCheckbox(
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void
  ): HTMLElement {
    const wrapper = createElementByHtml<HTMLLabelElement>(/*html*/ `
      <label
        style="margin-right:8px;">
        <input type="checkbox"
          class="listil-checkbox"
          style="margin-right:4px;"
        >${label}</label>
    `)!;

    const checkbox = wrapper.querySelector("input")!;
    checkbox.checked = checked;
    checkbox.addEventListener("change", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      onChange(checkbox.checked);
    });

    return wrapper;
  }

  /**
   * ラジオボタン作成
   */
  public createRadio(
    name: string,
    value: string,
    checked: boolean,
    onChange: (value: string) => void
  ): HTMLElement {
    const label = document.createElement("label");
    label.style.marginRight = "8px";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.className = "listil-radio";
    radio.name = name;
    radio.value = value;
    radio.checked = checked;
    radio.style.marginRight = "4px";

    radio.addEventListener("change", (e) => {
      if (radio.checked) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onChange(value);
      }
    });

    label.appendChild(radio);
    label.appendChild(document.createTextNode(value));
    return label;
  }

  public createRegexInput(regex: RegExp | null) {
    const input = createElementByHtml<HTMLInputElement>(/*html*/ `
      <input name="listil-pattern-input"
        placeholder="正規表現を入力...">
    `)!;
    input.value = regex?.source ?? "";
    return input;
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
            <button type="button" name="listil-save-button"
              style="margin-left:10px;">
              Save
            </button>
            <select name="listil-setting-select"></select>
          </div>
        </fieldset>
        <button type="button" name="listil-advanced-button"
          style="margin-left:10px;">
          Advanced
        </button>
      </div>
    `);

    // 正規表現入力
    const input = this.createRegexInput(setting.regex);
    input.className = "listil-regex-input";
    input.style.marginRight = "10px";

    // エラーメッセージ表示用
    const errorMessage = document.createElement("span");
    errorMessage.classList.add("listil-validation-error");
    errorMessage.style.display = "none"; // 初期状態は非表示
    errorMessage.textContent = "無効な正規表現です";

    input.addEventListener("input", (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const str = input.value.trim();
      if (str === "") {
        currentFirstSetting().regex = null;
        input.style.borderColor = ""; // 通常の枠に戻す
        errorMessage.style.display = "none";
        new ListFilter(list, currentSetting()).apply();
        return;
      }
      try {
        currentFirstSetting().regex = new RegExp(str, "gi");
        // 正常な場合：装飾をリセット
        input.style.borderColor = "";
        errorMessage.style.display = "none";
        new ListFilter(list, currentSetting()).apply();
      } catch (err) {
        // エラーの場合：赤枠＋エラーメッセージ
        currentFirstSetting().regex = null;
        input.style.borderColor = "red";
        errorMessage.style.display = "inline";
      }
    });

    // マッチモードラジオボタン群
    const invertBox = this.createCheckbox(
      "invert matching",
      setting.invertMatch,
      (state: boolean) => {
        currentFirstSetting().invertMatch = state;
        new ListFilter(list, currentSetting()).apply();
      }
    );

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

    // input とラジオボタンを横並びにするラッパー
    const topRow = wrapper.querySelector(".listil-top-row")!;

    topRow.prepend(input, errorMessage, invertBox);

    // 他のチェックボックスはそのまま
    const markerBox = this.createCheckbox(
      "Marker",
      setting.marker,
      (state: boolean) => {
        currentFirstSetting().marker = state;
        new ListFilter(list, currentSetting()).apply();
      }
    );

    const highlightBox = this.createCheckbox(
      "Highlight",
      setting.highlight,
      (state: boolean) => {
        currentFirstSetting().highlight = state;
        new ListFilter(list, currentSetting()).apply();
      }
    );

    const grayOutBox = this.createCheckbox(
      "GrayOut others",
      setting.grayOut,
      (state: boolean) => {
        currentFirstSetting().grayOut = state;
        new ListFilter(list, currentSetting()).apply();
      }
    );

    const narrowBox = this.createCheckbox(
      "Narrow others",
      setting.narrow,
      (state: boolean) => {
        currentFirstSetting().narrow = state;
        new ListFilter(list, currentSetting()).apply();
      }
    );

    const hideBox = this.createCheckbox(
      "Hide others",
      setting.hide,
      (state: boolean) => {
        currentFirstSetting().hide = state;
        new ListFilter(list, currentSetting()).apply();
      }
    );

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

    const fieldset = wrapper.querySelector("fieldset")!;
    fieldset.appendChild(topRow);
    fieldset.appendChild(markerBox);
    fieldset.appendChild(highlightBox);
    fieldset.appendChild(grayOutBox);
    fieldset.appendChild(narrowBox);
    fieldset.appendChild(hideBox);

    return wrapper;

    /**
     * 基本コントロール群の表示をリフレッシュ
     */
    function refreshBasicControls(
      firstSetting: FilterSettingInterface,
      newCurrentKey: string
    ) {
      input.value = firstSetting.regex?.source ?? "";
      settingSelect.length = 0;
      for (const key in listSetting.filterSettingSet) {
        const option = document.createElement("option");
        option.value = key;
        option.text = listSetting.filterSettingSet[key].name || key;
        settingSelect.appendChild(option);
      }
      settingSelect.value = newCurrentKey;
      (invertBox.firstChild as HTMLInputElement).checked =
        firstSetting.invertMatch;
      (markerBox.firstChild as HTMLInputElement).checked = firstSetting.marker;
      (highlightBox.firstChild as HTMLInputElement).checked =
        firstSetting.highlight;
      (grayOutBox.firstChild as HTMLInputElement).checked =
        firstSetting.grayOut;
      (narrowBox.firstChild as HTMLInputElement).checked = firstSetting.narrow;
      (hideBox.firstChild as HTMLInputElement).checked = firstSetting.hide;
    }
  }
}

/**
 * 事実上のリストにlist/listitemの識別タグを付加
 *
 * @param root - 探索の起点となるルート要素（デフォルトは document.body）
 */
function addPseudoType(root: Element = document.body): void {
  const candidateItems = Array.from(
    root.querySelectorAll<HTMLElement>(
      'div[role="listitem"], p[role="listitem"]'
    )
  );

  const groups = new Map<HTMLElement, HTMLElement[]>();

  for (const item of candidateItems) {
    if (item.dataset.pseudotype === PseudoType.listitem) continue;

    const parent = item.parentElement;
    if (!parent) continue;

    if (!groups.has(parent)) {
      groups.set(parent, []);
    }
    groups.get(parent)!.push(item);
  }

  for (const [parent, items] of groups) {
    if (items.length >= 5) {
      parent.dataset.pseudotype = PseudoType.list;
      for (const item of items) {
        item.dataset.pseudotype = PseudoType.listitem;
      }
    }
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

/**
 * idを持つ祖先要素を検索
 */
function findAncestorWithId(el: HTMLElement) {
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
    return {
      regexSource: setting.regex ? setting.regex.source : null,
      regexFlags: setting.regex ? setting.regex.flags : null,
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
    return {
      regex,
      marker: serialized.marker,
      highlight: serialized.highlight,
      grayOut: serialized.grayOut,
      hide: serialized.hide,
      invertMatch: serialized.invertMatch,
      narrow: serialized.narrow,
    };
  }
}

/**
 * トグルボタンとUI追加
 */
function addListilControlsToLists(): void {
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

    // ストレージから復元。0件であればデフォルト設定を使う。
    const listSetting = (await new ListSettingRepository().restore(
      createStorageKey(list.id)
    )) ?? {
      name: "xxxxx",
      filterSettingSet: {
        setting1: {
          name: "setting1",
          list: [defaultSetting],
        },
      },
    };
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

    const controls = new ControlFactory().createFilterControls(
      list,
      listSetting
    );
    controls.style.display = "none";

    const toggleBtnDiv = createElementByHtml(/*html*/ `
      <div class="listil-toggle-button-div">
        <button type="button" name="listil-showhide-toggle"
          class="listil-toggle-button"
          style="margin-bottom:6px;">
            Hide List
        </button>
        <button type="button" name="listil-onoff-toggle"
          class="listil-toggle-button"
          style="margin-bottom:6px;">
            Show Controls
        </button>
      </div>
    `);

    let listVisible = true;
    const toggleListBtn = toggleBtnDiv.querySelector(
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
    const toggleControlsBtn = toggleBtnDiv.querySelector(
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

    const rootDiv = createElementByHtml(/*html*/ `
      <div class="listil-root">
      </div>
    `);
    rootDiv.appendChild(toggleBtnDiv);
    rootDiv.appendChild(controls);

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
async function initialize() {
  const globalSetting = await globalSettingManager.load();
  const pageSetting = await pageSettingManager.findByUrl(location.href);
  console.log("DEBUG", "loaded globalSetting: ", globalSetting);
  console.log("DEBUG", "loaded pageSetting: ", pageSetting);
  if (pageSetting?.enabled ?? globalSetting.enabled ?? true) {
    addListilControlsToLists();
  }
}

// --- 実行 ---
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}

chrome.runtime.onMessage.addListener(
  (message: { type: string; enabled: boolean }, sender, sendResponse) => {
    // NOTE: 非同期で応答する場合、リスナー内で return true; が必要
    if (message.type === "enabled_changed") {
      if (message.enabled) {
        initialize();
      } else {
        cleanListilControls();
      }
      sendResponse({ success: true, data: {} });
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
        await initialize();
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
