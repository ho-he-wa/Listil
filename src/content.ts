import Mark from "mark.js";

console.log("[DEBUG] Content script loaded (mark.js version)");

/**
 * パターンマッチのモード(マッチする、マッチしない)
 */
type MatchMode = 'match' | 'not match';
const PseudoType = {
  list: 'list',
  listitem: 'listitem',
} as const;

/**
 * リスト設定インタフェース
 */
interface ListSettingsInterface {
  regex: RegExp | null;
  marker: boolean;
  highlight: boolean;
  grayOut: boolean;
  hide: boolean;
  invertMatch: boolean;
  matchMode: MatchMode; // [ ] TODO : invertMatch採用前の設定。不要であれば削除する。
  narrow: boolean;
}

// 初期デフォルト設定
const defaultSettings: ListSettingsInterface = {
  regex: null,
  marker: true,
  highlight: false,
  grayOut: false,
  hide: false,
  invertMatch: false,
  matchMode: 'match',
  narrow: false,
};

/**
 * スタイル追加（mark.js用、表示制御用）
 */
function injectStyles(): void {
  const style = document.createElement('style');
  // NOTE : 基本的にcssファイルにスタイルを設定
  style.textContent = `
  `;
  document.head.appendChild(style);
}

/**
 * 深さ制限付きで指定セレクタに一致する要素を探索する関数
 * 呼び出し時に型パラメータで戻り値の型を指定可能
 *
 * @param root - 探索の起点となるルート要素
 * @param selector - CSS セレクタ文字列
 * @param maxDepth - 探索する最大の深さ（0はルート自身）
 * @returns 条件に一致した要素の配列（指定された型にキャスト）
 */
function querySelectorAllWithDepth<T extends Element>(
  root: Element,
  selector: string,
  maxDepth: number = 1
): T[] {
  const results: T[] = [];
  const traverse = (node: Element, depth: number): void => {
    if (depth > maxDepth) return;

    if (node.matches(selector)) {
      results.push(node as T);  // 明示的にキャスト
    }
    for (const child of Array.from(node.children)) {
      traverse(child, depth + 1);
    }
  };
  traverse(root, 0);
  return results;
}

/**
 * コンテンツの領域を検索する
 */
function findContentContainers(): Element[] {
  const seen = new Set<Element>();
  const result: Element[] = [];
  const contentSelectors = ['main', /* '[id="main"]', '[id="content"]' */];
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
 * 指定要素配下の有効なフォーム要素を抽出する
 * 
 * - 同名がある場合は1つのみ抽出
 */
function extractValidFormElements(root: Element, withDisabled: boolean = false): Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> {
  const elements = root.querySelectorAll<HTMLElement>('input, select, textarea');
  const result = new Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>();
  elements.forEach(el => {
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) {
      if (!withDisabled && el.disabled) {
        return
      };
      if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') && !el.checked) {
        return
      };
      const key = el.name || el.id;
      if (!key) {
        return
      };
      result.set(key, el);
    }
  });
  return result;
}

/**
 * 指定要素配下の要素の data-* 属性および任意の指定属性を抽出して
 * 属性名 → 属性値 の Map の配列を返す。
 *
 * - 同名がある場合は1つのみ抽出
 * @param root - 探索対象のルート要素
 * @param targetAttributes - 抽出対象とする追加属性（例：['href', 'src']）
 * @returns Map<string, string>[] - 属性名をキー、属性値を値とするMapの配列
 */
function extractAttributeMaps(
  root: Element,
  targetAttributes: string[] = ['href']
): Map<string, string>[] {
  const result: Map<string, string>[] = [];
  const elements = root.querySelectorAll<HTMLElement>('*');
  elements.forEach(el => {
    // data-* 属性と指定されたその他の属性を抽出
    const item = new Map<string, string>();
    Array.from(el.attributes)
      .filter((attr) => attr.name.startsWith('data-') || targetAttributes.includes(attr.name))
      .forEach(attr => {
        console.log('DEBUG attribute:', attr);
        item.set(attr.name, attr.value); // e.g., "data-role" => "admin"
      });
    if (item.size > 0) {
      result.push(item);
    }
  });
  return result;
}

/**
 * リストの検索処理
 */
class ListFinder {
  private excludeSelector = 'nav, footer, header, #nav, #footer, #header';
  private excludeSuffixes = ['menu', 'Menu', 'nav', 'Nav'];
  private contentContainers: Element[];

  constructor(contentContainers: Element[]) {
    this.contentContainers = contentContainers;
  }

  public findLists(): HTMLElement[] {
    const lists: HTMLElement[] = [];

    this.contentContainers.forEach(container => {
      const listElements = container.querySelectorAll<HTMLElement>(`ul, ol, table, [data-pseudotype="${PseudoType.list}"]`);

      listElements.forEach(list => {
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
    console.log('[DEBUG] ' + (el.dataset.pseudotype ?? '-'));

    // 対象外の要素配下か
    if (el.closest(this.excludeSelector)) return false;
    if (this.hasExcludedAncestor(el)) return false;

    if (tag === 'table') {
      // NOTE : tbodyを挟む場合があるので深さ2を指定
      return querySelectorAllWithDepth(el, 'tr', 2).length >= 10;
    } else if (tag === 'ul' || tag === 'ol') {
      return querySelectorAllWithDepth(el, 'li', 1).length >= 10;
    } else if (el.dataset.pseudotype === PseudoType.list) {
      console.log('[DEBUG] pseudo listitem');
      return querySelectorAllWithDepth(el, `[data-pseudotype="${PseudoType.listitem}"]`, 1).length >= 10;
    }

    return false;
  }

  /**
   * 対象外のサフィックスの祖先要素配下か
   */
  private hasExcludedAncestor(el: Element): boolean {
    let current: Element | null = el;
    while (current) {
      const id = current.id || '';
      const classList = Array.from(current.classList);

      const matches = this.excludeSuffixes.some(suffix =>
        id.endsWith(suffix) || classList.some(cls => cls.endsWith(suffix))
      );

      if (matches) return true;

      current = current.parentElement;
    }

    return false;
  }
}

/**
 * リストを検索
 */
function findLists(): HTMLElement[] {
  const contentContainers = findContentContainers();
  const finder = new ListFinder(contentContainers);
  return finder.findLists();
}

/**
 * 要素は非表示か否か
 */
function isInvisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  const size = getContentBoxSize(el);
  const invisible = style.display === 'none' || size.width === 0 || size.height === 0;
  return invisible;
}

/**
 * 指定要素の高さと幅 (パディング含まない) を取得する
 */
function getContentBoxSize(el: HTMLElement): { width: number, height: number } {
  const style = window.getComputedStyle(el);
  const boxSizing = style.boxSizing;
  let width = el.clientWidth;
  let height = el.clientHeight;
  // NOTE : content-box の場合は rect.width = content size なのでそのまま返す
  if (boxSizing === 'border-box') {
    // NOTE : clientWidth には padding は含まれるが border は含まれない
    const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    width -= paddingX;
    height -= paddingY;
  }
  return {
    width: Math.max(0, width),
    height: Math.max(0, height),
  };
}

/**
 * リストフィルター
 */
class ListFilter {
  private list: HTMLElement;
  private settingsList: ListSettingsInterface[];
  private listSettingId: string | undefined;

  /**
   * 
   * @param list 対象リスト
   * @param settingsList リスト設定の配列
   */
  constructor(list: HTMLElement, settingsList: ListSettingsInterface[]) {
    this.list = list;
    this.settingsList = settingsList;
    this.listSettingId = list.dataset.listSettingId;
  }

  /**
   * リストにフィルターを適用
   */
  public apply(): void {
    const items = this.findListItems();
    this.removeMarkers();
    this.removeHighlights();

    items.forEach((item: HTMLElement) => {
      this.settingsList.forEach((settings, index) => {
        this.applyToItem(item, settings, index === 0);
      });
    });
  }

  /**
   * リスト項目を抽出する
   */
  private findListItems() {
    let items: HTMLElement[];
    if (this.list.matches(`[data-pseudotype="${PseudoType.list}"]`)) {
      items = querySelectorAllWithDepth(this.list, `[data-pseudotype="${PseudoType.listitem}"]`, 1);
    } else {
      const tag = this.list.tagName.toLowerCase();
      items = tag === 'table'
        ? querySelectorAllWithDepth<HTMLElement>(this.list, 'tr', 2).filter((tr) => !this.shouldExcludeTableRow(tr))
        : querySelectorAllWithDepth(this.list, 'li', 1);
    }
    return items;
  }

  /**
   * リストの項目にフィルターを適用
   */
  public applyToItem(item: HTMLElement, settings: ListSettingsInterface, reset: boolean = true) {
    // 元々非表示な要素は無視
    const originallyHidden = (item.dataset.ignore ?? null) == null && isInvisible(item);
    if (originallyHidden || (item.dataset.ignore === 'yes')) {
      item.dataset.ignore = 'yes';
      return;
    }
    item.dataset.ignore = 'no';

    // 表示リセット
    reset && this.resetItem(item);

    const text: string = item.innerText;
    const textMatch = settings.regex && text.match(settings.regex) !== null;
    let match = textMatch;
    if (!match) {
      const formElements = extractValidFormElements(item, true);
      const formValueMatch = Array.from(formElements).some(([key, formElement]) => {
        console.log('DEBUG', 'form element value: ', { name: key, value: formElement.value });
        return settings.regex && formElement.value?.match(settings.regex) !== null;
      });
      match = formValueMatch;
    }
    if (!match) {
      const attributeMaps = extractAttributeMaps(item);
      const attributeMatch = attributeMaps.some((attributeMap) => {
        console.log('DEBUG', 'element attributes:', attributeMap);
        return Array.from(attributeMap).some(([key, attribute]) => {
          console.log('DEBUG', 'element attribute: ', { attributeName: key, value: attribute });
          return settings.regex && attribute.match(settings.regex) !== null;
        });
      });
      match = attributeMatch;
    }
    const isMatchedTarget = settings.regex
      ? settings.matchMode === 'match' ? match : !match
      : false;
    const isNotMatchedTarget = settings.regex
      ? settings.matchMode === 'match' ? !match : match
      : false;

    if (isMatchedTarget) {
      if (settings.marker) {
        this.applyMarkers(item, settings);
      }
      if (settings.highlight) {
        this.applyHighlights(item);
      }
    }
    if (isNotMatchedTarget) {
      if (settings.grayOut) {
        item.classList.add('listil-grayout');
      }
      if (settings.hide) {
        item.classList.add('listil-hide');
      }
      if (settings.narrow) {
        this.applyNarrow(item);
      }
    }
  }

  public resetItem(item: HTMLElement) {
    item.classList.remove(
      'listil-grayout',
      'listil-hide',
      'listil-narrow'
    );
    // trの高さ制限用ラッパーを削除
    if (item.tagName.toLowerCase() === 'tr') {
      item.querySelectorAll('.listil-td-inner').forEach(tdInner => {
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
    item.classList.add('listil-narrow');
    // trの高さ制限
    if (item.tagName.toLowerCase() === 'tr') {
      Array.from(item.children).forEach(trChild => {
        if (trChild.tagName.toLowerCase() !== 'td') { return; }
        if (trChild.classList.contains('listil-td-inner')) { return; }
        const tdInner = document.createElement("div");
        tdInner.className = 'listil-td-inner';
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
    if (tr.closest('thead') || tr.closest('tfoot') || querySelectorAllWithDepth(tr, 'td', 1).length <= 0) {
      return true;
    }
    return false;
  }

  /**
   * マーカーを適用
   */
  private applyMarkers(element: HTMLElement, settings: ListSettingsInterface): void {
    const instance = new Mark(element);
    instance.unmark({
      done: () => {
        if (settings.regex) {
          instance.markRegExp(settings.regex, {
            className: 'listil-custom-mark',
          });
        }
      }
    });
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
    element.classList.add('listil-highlight-item');
  }

  /**
   * ハイライトを削除
   */
  private removeHighlights(): void {
    if (!this.listSettingId) return;
    const items = this.list.querySelectorAll('.listil-highlight-item');
    items.forEach(item => item.classList.remove('listil-highlight-item'));
  }
}

/**
 * アドバンスド設定モーダル
 */
class AdvancedSettingsModal {
  private settingsList: ListSettingsInterface[];
  private modal: HTMLDivElement;
  private onchange: () => void;

  constructor(settingsList: ListSettingsInterface[], onchange: () => void) {
    this.settingsList = settingsList;
    this.modal = this.createModal();
    this.onchange = onchange;
  }

  public open(): void {
    document.body.appendChild(this.modal);
  }

  private createModal(): HTMLDivElement {
    const modal = document.createElement('div');
    modal.className = 'listil-modal';

    const overlay = document.createElement('div');
    overlay.className = 'listil-overlay';
    overlay.addEventListener('click', () => this.close());

    const content = document.createElement('div');
    content.className = 'listil-modal-content';

    const title = document.createElement('h3');
    title.textContent = 'Advanced Filter Settings';
    title.className = 'listil-modal-title';

    const listWrapper = document.createElement('div');
    listWrapper.className = 'listil-setting-list';

    this.settingsList.forEach((settings, index) => {
      const item = this.createSettingsEditor(settings, index);
      listWrapper.appendChild(item);
    });

    const addBtn = document.createElement('button');
    addBtn.textContent = '＋ Add Filter';
    addBtn.addEventListener('click', () => {
      const newSetting = { ...defaultSettings };
      this.settingsList.push(newSetting);
      const item = this.createSettingsEditor(newSetting, this.settingsList.length - 1);
      listWrapper.appendChild(item);
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✖ Close';
    closeBtn.addEventListener('click', () => this.close());

    content.appendChild(title);
    content.appendChild(listWrapper);
    content.appendChild(addBtn);
    content.appendChild(closeBtn);
    modal.appendChild(overlay);
    modal.appendChild(content);

    return modal;
  }

  private createSettingsEditor(settings: ListSettingsInterface, index: number): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'listil-setting-editor';

    const title = document.createElement('h4');
    title.textContent = `#${index + 1}`;
    title.className = 'listil-modal-setting-no';

    const input = (new ControlFactory).createRegexInput(settings.regex);
    input.className = 'listil-modal-setting-input';

    // エラーメッセージ表示用
    const errorMessage = document.createElement('span');
    errorMessage.classList.add('listil-validation-error');
    errorMessage.style.display = 'none';
    errorMessage.textContent = '無効な正規表現です';

    input.addEventListener('input', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const str = input.value.trim();
      if (str === '') {
        settings.regex = null;
        input.style.borderColor = ''; // 通常の枠に戻す
        errorMessage.style.display = 'none';
        this.onchange();
        return;
      }
      try {
        settings.regex = new RegExp(str, 'gi');
        // 正常な場合：装飾をリセット
        input.style.borderColor = '';
        errorMessage.style.display = 'none';
        this.onchange();
      } catch (err) {
        // エラーの場合：赤枠＋エラーメッセージ
        settings.regex = null;
        input.style.borderColor = 'red';
        errorMessage.style.display = 'inline';
      }
    });

    const invertCheckbox = (new ControlFactory).createCheckbox('Invert', settings.invertMatch ?? false, (checked) => {
      settings.invertMatch = checked;
      settings.matchMode = !checked ? 'match' : 'not match'; // 以前のマッチモードラジオボタンとの互換用
      this.onchange();
    });
    const markerCheckbox = (new ControlFactory).createCheckbox('Marker', settings.marker ?? false, (checked) => {
      settings.marker = checked;
      this.onchange();
    });
    const highlightCheckbox = (new ControlFactory).createCheckbox('Highlight', settings.highlight ?? false, (checked) => {
      settings.highlight = checked;
      this.onchange();
    });
    const grayOutCheckbox = (new ControlFactory).createCheckbox('GrayOut other', settings.grayOut ?? false, (checked) => {
      settings.grayOut = checked;
      this.onchange();
    });
    const narrowCheckbox = (new ControlFactory).createCheckbox('Narrow other', settings.narrow ?? false, (checked) => {
      settings.narrow = checked;
      this.onchange();
    });
    const hidecheckbox = (new ControlFactory).createCheckbox('Hide other', settings.hide ?? false, (checked) => {
      settings.hide = checked;
      this.onchange();
    });

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '🗑';
    removeBtn.title = 'Remove this filter';
    removeBtn.addEventListener('click', () => {
      if (this.settingsList.length <= 1) {
        alert('2件以上ある場合のみ削除できます。');
        return;
      }
      this.settingsList.splice(index, 1);
      this.onchange();
      this.modal.remove(); // 再生成
      this.modal = this.createModal();
      this.open();
    });

    const topRow = document.createElement('div');
    topRow.style.width = '100%';
    topRow.appendChild(input);
    topRow.appendChild(errorMessage);
    topRow.appendChild(invertCheckbox);

    const fieldset = document.createElement('fieldset');
    fieldset.className = 'listil-fieldset';

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
  public createCheckbox(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
    const wrapper = document.createElement('label');
    wrapper.style.marginRight = '8px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = checked;
    checkbox.style.marginRight = '4px';

    checkbox.addEventListener('change', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation()
      onChange(checkbox.checked);
    });

    wrapper.appendChild(checkbox);
    wrapper.appendChild(document.createTextNode(label));
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
    const label = document.createElement('label');
    label.style.marginRight = '8px';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = name;
    radio.value = value;
    radio.checked = checked;
    radio.style.marginRight = '4px';

    radio.addEventListener('change', (e) => {
      if (radio.checked) {
        e.preventDefault();
        e.stopImmediatePropagation()
        onChange(value);
      }
    });

    label.appendChild(radio);
    label.appendChild(document.createTextNode(value));
    return label;
  }

  public createInput(value: string): HTMLInputElement {
    const input = document.createElement('input');
    input.value = value;
    return input;
  }

  public createRegexInput(regex: RegExp | null) {
    const input = this.createInput(regex?.source ?? '');
    input.placeholder = '正規表現を入力...';
    return input;
  }

  /**
   * コントロール UI 作成
   * 
   * @param list 
   * @param settingsList
   */
  public createFilterControls(list: HTMLElement, settingsList: ListSettingsInterface[]): HTMLElement {
    // [x] TODO : settingsとsettingsListの2つあるのは冗長なので整理する
    if (settingsList.length <= 0) {
      throw new Error('Violation. The settingsList is Empty.');
    }
    const settings = settingsList[0];

    // 正規表現入力
    const input = this.createRegexInput(settings.regex);
    input.className = 'listil-regex-input';
    input.style.marginRight = '10px';

    // エラーメッセージ表示用
    const errorMessage = document.createElement('span');
    errorMessage.classList.add('listil-validation-error');
    errorMessage.style.display = 'none'; // 初期状態は非表示
    errorMessage.textContent = '無効な正規表現です';

    input.addEventListener('input', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const str = input.value.trim();
      if (str === '') {
        settings.regex = null;
        input.style.borderColor = ''; // 通常の枠に戻す
        errorMessage.style.display = 'none';
        new ListFilter(list, settingsList).apply();
        return;
      }
      try {
        settings.regex = new RegExp(str, 'gi');
        // 正常な場合：装飾をリセット
        input.style.borderColor = '';
        errorMessage.style.display = 'none';
        new ListFilter(list, settingsList).apply();
      } catch (err) {
        // エラーの場合：赤枠＋エラーメッセージ
        settings.regex = null;
        input.style.borderColor = 'red';
        errorMessage.style.display = 'inline';
      }
    });

    // マッチモードラジオボタン群
    const invertBox = this.createCheckbox('invert matching', settings.invertMatch, (state: boolean) => {
      settings.invertMatch = state;
      settings.matchMode = !state ? 'match' : 'not match'; // 以前のマッチモードラジオボタンとの互換用
      new ListFilter(list, settingsList).apply();
    });

    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.type = 'button';
    saveButton.style.marginLeft = '10px';
    saveButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      (new ListSettingsRepository).save(list.id, settingsList);
    });

    // input とラジオボタンを横並びにするラッパー
    const topRow = document.createElement('div');
    topRow.classList.add('listil-top-row');

    topRow.appendChild(input);
    topRow.appendChild(errorMessage); // input, invertBox, saveButton の行に追加
    topRow.appendChild(invertBox);
    topRow.appendChild(saveButton);

    // 他のチェックボックスはそのまま
    const markerBox = this.createCheckbox('Marker', settings.marker, (state: boolean) => {
      settings.marker = state;
      new ListFilter(list, settingsList).apply();
    });

    const highlightBox = this.createCheckbox('Highlight', settings.highlight, (state: boolean) => {
      settings.highlight = state;
      new ListFilter(list, settingsList).apply();
    });

    const grayOutBox = this.createCheckbox('GrayOut others', settings.grayOut, (state: boolean) => {
      settings.grayOut = state;
      new ListFilter(list, settingsList).apply();
    });

    const narrowBox = this.createCheckbox('Narrow others', settings.narrow, (state: boolean) => {
      settings.narrow = state;
      new ListFilter(list, settingsList).apply();
    });

    const hideBox = this.createCheckbox('Hide others', settings.hide, (state: boolean) => {
      settings.hide = state;
      new ListFilter(list, settingsList).apply();
    });

    const advancedBtn = document.createElement('button');
    advancedBtn.textContent = 'Advanced';
    advancedBtn.type = 'button';
    advancedBtn.style.marginLeft = '10px';
    advancedBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      new AdvancedSettingsModal(settingsList, () => {
        new ListFilter(list, settingsList).apply();
        if (settingsList.length <= 0) {
          throw new Error('Violation. The settingsList is Empty.');
        }
        // 基本コントロールの状態を更新
        const firstSettings = settingsList[0];
        input.value = firstSettings.regex?.source ?? '';
        (invertBox.firstChild as HTMLInputElement).checked = firstSettings.invertMatch;
        (markerBox.firstChild as HTMLInputElement).checked = firstSettings.marker;
        (highlightBox.firstChild as HTMLInputElement).checked = firstSettings.highlight;
        (grayOutBox.firstChild as HTMLInputElement).checked = firstSettings.grayOut;
        (narrowBox.firstChild as HTMLInputElement).checked = firstSettings.narrow;
        (hideBox.firstChild as HTMLInputElement).checked = firstSettings.hide;
      }).open();
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'listil-controls';
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'listil-fieldset';

    fieldset.appendChild(topRow);
    fieldset.appendChild(markerBox);
    fieldset.appendChild(highlightBox);
    fieldset.appendChild(grayOutBox);
    fieldset.appendChild(narrowBox);
    fieldset.appendChild(hideBox);
    wrapper.appendChild(fieldset);
    wrapper.appendChild(advancedBtn);

    return wrapper;
  }
}

/**
 * 事実上のリストにlist/listitemの識別タグを付加
 * 
 * @param root - 探索の起点となるルート要素（デフォルトは document.body）
 */
function addPseudoType(root: Element = document.body): void {
  const candidateItems = Array.from(
    root.querySelectorAll<HTMLElement>('div[role="listitem"], p[role="listitem"]')
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
  const targets = root.querySelectorAll<HTMLElement>(`ul, ol, table, [data-pseudotype="${PseudoType.list}"]`);
  const groupCounters = new Map<string, number>();
  targets.forEach((el) => {
    if (el.id) { return; }
    // 最も近い id を持つ祖先要素を探す
    const ancestor = findAncestorWithId(el);
    const ancestorId = ancestor ? ancestor.id : undefined;
    el.setAttribute('data-listil-group', ancestorId ?? '');
    // group 用に連番管理
    const groupPrefix = `listil-${ancestorId ?? ''}`;
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

class ListSettingsRepository {
  /**
   * 保存
   */
  public save(listId: string, settingsList: ListSettingsInterface[]): void {
    const key = this.generateStorageKey(listId);
    const serialized = settingsList.map(this.serializeSettings);
    chrome.storage.local.set({ [key]: serialized }, () => {
      console.log(`[listil] Saved settings array for ${key}`);
    });
  }

  /**
   * 復元
   */
  public async restore(listId: string): Promise<ListSettingsInterface[] | null> {
    const key = this.generateStorageKey(listId);
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (result[key] && Array.isArray(result[key])) {
          const deserialized = result[key].map(this.deserializeSettings);
          resolve(deserialized);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * 保存キー生成
   */
  private generateStorageKey(listId: string, url: string = location.href): string {
    const wkUrl = location.href.replace(/^https?:\/\//, '').replace(/[#?].*$/, '');
    return `${wkUrl}#${listId}`;
  }

  /**
   * リスト設定のシリアライズ
   */
  private serializeSettings(settings: ListSettingsInterface): object {
    return {
      regexSource: settings.regex ? settings.regex.source : null,
      regexFlags: settings.regex ? settings.regex.flags : null,
      marker: settings.marker,
      highlight: settings.highlight,
      grayOut: settings.grayOut,
      hide: settings.hide,
      invertMatch: settings.invertMatch,
      matchMode: settings.matchMode,
      narrow: settings.narrow,
    };
  }

  /**
   * リスト設定のデシリアライズ
   */
  private deserializeSettings(serialized: any): ListSettingsInterface {
    let regex: RegExp | null = null;
    try {
      if (serialized.regexSource && serialized.regexFlags !== null) {
        regex = new RegExp(serialized.regexSource, serialized.regexFlags);
      }
    } catch (e) {
      console.warn('[listil] 正規表現の復元に失敗しました', e);
    }

    return {
      regex,
      marker: serialized.marker,
      highlight: serialized.highlight,
      grayOut: serialized.grayOut,
      hide: serialized.hide,
      invertMatch: serialized.invertMatch,
      matchMode: serialized.matchMode,
      narrow: serialized.narrow,
    };
  }
}

/**
 * トグルボタンとUI追加
 */
function addListilControlsToLists(): void {
  const timerName = '[DEBUG] addListilControlsToLists';
  console.time(timerName);
  injectStyles();
  console.timeLog(timerName);
  const contentContainers = findContentContainers();
  contentContainers.forEach((container) => { addPseudoType(container); });
  contentContainers.forEach((container) => { assignIdToListElements(container); });
  console.timeLog(timerName);
  const finder = new ListFinder(contentContainers);
  const lists = finder.findLists();
  console.timeLog(timerName);

  lists.forEach(async (list: HTMLElement, index: number) => {
    const listSettingId = `list-${index}`;
    list.dataset.listSettingId = listSettingId;

    // ストレージから復元。0件であればデフォルト設定を使う。
    const restoredSettingList = await (new ListSettingsRepository).restore(list.id) ?? [];
    const settingsList = (restoredSettingList.length > 0 ? restoredSettingList : [defaultSettings]).map((settings) => {
      // データ仕様変更を考慮してデフォルト設定とマージ
      return { ...defaultSettings, ...settings };
    });
    console.log(`[DEBUG]`, `Loaded settings`, settingsList);

    const controls = (new ControlFactory).createFilterControls(list, settingsList);
    controls.style.display = 'none';

    const toggleListBtn = document.createElement('button');
    toggleListBtn.type = 'button';
    toggleListBtn.textContent = 'Hide List';
    toggleListBtn.className = 'listil-toggle-button';
    toggleListBtn.style.marginBottom = '6px';
    let listVisible = true;
    toggleListBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation()
      listVisible = !listVisible;
      list.style.display = listVisible ? '' : 'none';
      toggleListBtn.textContent = listVisible ? 'Hide List' : 'Show List';
    });

    const toggleControlsBtn = document.createElement('button');
    toggleControlsBtn.type = 'button';
    toggleControlsBtn.textContent = 'Show Controls';
    toggleControlsBtn.className = 'listil-toggle-button';
    toggleControlsBtn.style.marginBottom = '6px';
    let controlsVisible = false;
    toggleControlsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation()
      controlsVisible = !controlsVisible;
      controls.style.display = controlsVisible ? '' : 'none';
      toggleControlsBtn.textContent = controlsVisible ? 'Hide Controls' : 'Show Controls';
    });

    const toggleBtnDiv = document.createElement('div');
    toggleBtnDiv.className = 'listil-toggle-button-div';
    toggleBtnDiv.appendChild(toggleListBtn);
    toggleBtnDiv.appendChild(toggleControlsBtn);

    list.parentNode!.insertBefore(controls, list);
    list.parentNode!.insertBefore(toggleBtnDiv, controls);

    // リスト設定復元時はリストのフィルターを適用
    if (restoredSettingList.length > 0) {
      new ListFilter(list, settingsList).apply();
    }
  });
  console.timeEnd(timerName);
}

// --- 実行 ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addListilControlsToLists);
} else {
  addListilControlsToLists();
}
