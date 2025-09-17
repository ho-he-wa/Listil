import { controlsRoot } from "@/Content/Views/controlsRoot";
import { listilModal } from "@/Content/Views/listilModal";
import { listilModalSettingEditor } from "@/Content/Views/listilModalSettingEditor";
import { colorClassSelect } from "@/Dom/colorSelect";
import { createElementByHtml } from "@/Dom/createElementByHtml";
import { dragAndDrop } from "@/Dom/dragAndDrop";
import { findAncestorWithId } from "@/Dom/findAncestorWithId";
import { GlobalSettingManager } from "@/GlobalSetting/GlobalSettingManager";
import { defaultSetting } from "@/ListFilter/defaultSetting";
import {
  FilterSettingInterface,
  FilterSettingList,
  ListSettingInterface,
} from "@/ListFilter/Interface";
import { KeyPrefix } from "@/ListFilter/KeyPrefix";
import { ListFilter } from "@/ListFilter/ListFilter";
import { ListFinder } from "@/ListFilter/ListFinder";
import { ListSettingRepository } from "@/ListFilter/ListSettingRepository";
import { addPseudoType, PseudoType } from "@/ListFilter/PseudoType";
import { cleanUrl } from "@/Misc/MyURL";
import { PageSettingManager } from "@/PageSetting/PageSettingManager";

console.log("[DEBUG] Content script loaded (mark.js version)");

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

    const modalBody = this.modal.querySelector<HTMLElement>(
      '[data-name="listil-modal-content"]'
    )!;
    dragAndDrop(modalBody).apply();
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

    const markerColor = wrapper.querySelector(
      'input[name="marker-color"]'
    )! as HTMLInputElement;
    colorClassSelect(markerColor, setting.markerColor, (v) => {
      setting.markerColor = v;
      this.onchange(this.currentSettingList(), this.currentKey);
    }).apply();
    const invertMarkerColor = wrapper.querySelector(
      'input[name="invert-marker-color"]'
    )! as HTMLInputElement;
    colorClassSelect(invertMarkerColor, setting.invertMarkerColor, (v) => {
      setting.invertMarkerColor = v;
      this.onchange(this.currentSettingList(), this.currentKey);
    }).apply();

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
  public async createFilterControls(
    list: HTMLElement,
    listSetting: ListSettingInterface<FilterSettingInterface>
  ): Promise<HTMLElement> {
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
              placeholder="Enter search criteria..."
              class="listil-regex-input"
              style="margin-right: 10px;">
            <span data-name="listil-pattern-error"
              class="listil-validation-error" style="display: none;">
                Invalid regular expression.
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
    saveButton.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      new ListSettingRepository().save(
        await createStorageKey(list.id),
        listSetting
      );
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
 * 保存キー生成。
 *
 * - 現在のページのURLパターンを用いて保存する。ページのURLパターンが設定されていない場合は現在URLをそのままURLパターンとして用いる。
 */
async function createStorageKey(listId: string): Promise<string> {
  const currentUrl = location.href;
  const pageSettingManager = new PageSettingManager();
  const pageSetting = await pageSettingManager.findByUrl(currentUrl);
  const wkUrl =
    KeyPrefix.listSettings + (pageSetting?.urlPattern ?? cleanUrl(currentUrl));
  return `${wkUrl}#${listId}`;
}

const listSettings = new Map<
  string,
  ListSettingInterface<FilterSettingInterface>
>();

/**
 * トグルボタンとUI追加
 */
async function addListilControlsToLists(skipReload: boolean = false) {
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
    const key = await createStorageKey(list.id);
    if (listSettings.get(key) == null || !skipReload) {
      // ストレージから復元。0件であればデフォルト設定を使う。
      const defaultListSetting = {
        name: "xxxxx",
        listId: list.id,
        filterSettingSet: {
          setting1: {
            name: "setting1",
            list: [defaultSetting],
          },
        },
      };
      const wkListSetting = await new ListSettingRepository().restore(key);
      listSettings.set(key, {
        ...defaultListSetting,
        ...(wkListSetting ?? {}),
      });
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

    const controls = await new ControlFactory().createFilterControls(
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
  console.time("[DEBUG] initialize");
  const globalSetting = await globalSettingManager.load();
  const pageSetting = await pageSettingManager.findByUrl(
    cleanUrl(location.href)
  );
  console.log("DEBUG", "loaded globalSetting: ", globalSetting);
  console.log("DEBUG", "loaded pageSetting: ", pageSetting);
  if (pageSetting?.enabled ?? globalSetting.enabled ?? true) {
    await addListilControlsToLists(skipReload);
  }
  console.timeEnd("[DEBUG] initialize");
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
