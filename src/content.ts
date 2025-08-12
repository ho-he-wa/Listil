import Mark from "mark.js";

console.log("[DEBUG] Content script loaded (mark.js version)");

/**
 * パターンマッチのモード(マッチする、マッチしない)
 */
type MatchMode = 'match' | 'not match';

/**
 * リスト設定インタフェース
 */
interface ListSettings {
  regex: RegExp | null;
  highlight: boolean;
  grayOut: boolean;
  hide: boolean;
  matchMode: MatchMode;
  narrow: boolean;
}

/**
 * マッピング(リストID -> リスト設定)
 */
const listSettings = new Map<string, ListSettings>(); // listId -> settings

/**
 * スタイル追加（mark.js用、表示制御用）
 */
function injectHighlightStyle(): void {
  const style = document.createElement('style');
  style.textContent = `
    mark.custom-mark {
      background-color: yellow;
      color: black;
    }
    .narrow-list > li,
    .narrow-list > tr {
      max-height: 3.0rem;
      overflow: hidden;
    }
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
      const listElements = container.querySelectorAll<HTMLElement>('ul, ol, table, [data-pceudotype="list"]');

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
    console.log('[DEBUG] ' + (el.dataset.pceudotype ?? '-'));

    // 対象外の要素配下か
    if (el.closest(this.excludeSelector)) return false;
    if (this.hasExcludedAncestor(el)) return false;

    if (tag === 'table') {
      // NOTE : tbodyを挟む場合があるので深さ2を指定
      return querySelectorAllWithDepth(el, 'tr', 2).length >= 10;
    } else if (tag === 'ul' || tag === 'ol') {
      return querySelectorAllWithDepth(el, 'li', 1).length >= 10;
    } else if (el.dataset.pceudotype === 'list') {
      console.log('[DEBUG] pseudo listitem');
      return querySelectorAllWithDepth(el, '[data-pceudotype="listitem"]', 1).length >= 10;
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
 * リストフィルター
 */
class ListFilter {
  private list: HTMLElement;
  private settings: ListSettings;
  private listId: string | undefined;

  constructor(list: HTMLElement, settings: ListSettings) {
    this.list = list;
    this.settings = settings;
    this.listId = list.dataset.listTogglerId;
  }

  /**
   * フィルターを適用
   */
  public apply(): void {
    let items: HTMLElement[];

    if (this.list.matches('[data-pceudotype="list"]')) {
      items = querySelectorAllWithDepth(this.list, '[data-pceudotype="listitem"]', 1);
    } else {
      const tag = this.list.tagName.toLowerCase();
      items = tag === 'table'
        ? querySelectorAllWithDepth(this.list, 'tr', 2)
        : querySelectorAllWithDepth(this.list, 'li', 1);
    }
    this.removeHighlights();

    items.forEach((item: HTMLElement) => {
      // 元々非表示な要素は無視
      const style = window.getComputedStyle(item);
      if (((item.dataset.ignore ?? null) == null && style.display === 'none') || (item.dataset.ignore === 'yes')) {
        item.dataset.ignore = 'yes';
        return;
      }
      item.dataset.ignore = 'no';

      item.style.opacity = '';
      item.style.display = '';
      item.style.maxHeight = '';

      const text: string = item.innerText;
      const match = this.settings.regex && text.match(this.settings.regex) !== null;
      const isTarget = this.settings.regex
        ? this.settings.matchMode === 'match' ? match : !match
        : false;

      if (isTarget) {
        if (this.settings.highlight) {
          this.applyHighlights(item);
        }
        if (this.settings.grayOut) {
          item.style.opacity = '0.3';
        }
        if (this.settings.hide) {
          item.style.display = 'none';
        }
        if (this.settings.narrow) {
          item.style.maxHeight = '3.0rem';
          item.style.overflow = 'hidden';
        }
      }
    });
  }



  /**
   * ハイライトを適用
   */
  private applyHighlights(element: HTMLElement): void {
    const instance = new Mark(element);
    instance.unmark({
      done: () => {
        if (this.settings.regex) {
          instance.markRegExp(this.settings.regex, {
            className: 'custom-mark',
          });
        }
      }
    });
  }

  /**
   * ハイライトを削除
   */
  private removeHighlights(): void {
    if (!this.listId) return;

    const instance = new Mark(this.list);
    instance.unmark();
  }
}

/**
 * チェックボックス作成
 */
function createCheckbox(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
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
function createRadio(
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

/**
 * コントロール UI 作成
 */
function createRegexControls(list: HTMLElement): HTMLElement {
  const id = list.dataset.listTogglerId!;
  const settings = listSettings.get(id)!;

  // 正規表現入力
  const input = document.createElement('input');
  input.placeholder = '正規表現を入力...';
  input.className = 'regex-input';
  input.style.marginRight = '10px';

  input.addEventListener('input', (e) => {
    e.preventDefault();
    e.stopImmediatePropagation()
    const str = input.value;
    try {
      settings.regex = new RegExp(str, 'gi');
    } catch {
      settings.regex = null;
    }
    new ListFilter(list, settings).apply();
  });

  // マッチモードラジオボタン群
  const matchModeGroup = document.createElement('div');
  matchModeGroup.style.display = 'inline-flex';    // 横並びにする
  matchModeGroup.style.alignItems = 'center';
  matchModeGroup.style.gap = '8px';               // ラジオボタン間の隙間

  matchModeGroup.appendChild(createRadio(`matchmode-${id}`, 'match', settings.matchMode === 'match', (val: string) => {
    settings.matchMode = val as MatchMode;
    new ListFilter(list, settings).apply();
  }));

  matchModeGroup.appendChild(createRadio(`matchmode-${id}`, 'not match', settings.matchMode === 'not match', (val: string) => {
    settings.matchMode = val as MatchMode;
    new ListFilter(list, settings).apply();
  }));


  // input とラジオボタンを横並びにするラッパー
  const topRow = document.createElement('div');
  topRow.style.display = 'flex';
  topRow.style.alignItems = 'center';
  topRow.style.marginBottom = '8px';

  topRow.appendChild(input);
  topRow.appendChild(matchModeGroup);

  // 他のチェックボックスはそのまま
  const highlightBox = createCheckbox('Highlight', settings.highlight, (state: boolean) => {
    settings.highlight = state;
    new ListFilter(list, settings).apply();
  });

  const grayOutBox = createCheckbox('GrayOut', settings.grayOut, (state: boolean) => {
    settings.grayOut = state;
    new ListFilter(list, settings).apply();
  });

  const narrowBox = createCheckbox('Narrow', settings.narrow, (state: boolean) => {
    settings.narrow = state;
    new ListFilter(list, settings).apply();
  });

  const hideBox = createCheckbox('Hide', settings.hide, (state: boolean) => {
    settings.hide = state;
    new ListFilter(list, settings).apply();
  });


  const wrapper = document.createElement('div');
  wrapper.className = 'list-controls';
  wrapper.style.marginBottom = '10px';

  wrapper.appendChild(topRow);
  wrapper.appendChild(highlightBox);
  wrapper.appendChild(grayOutBox);
  wrapper.appendChild(narrowBox);
  wrapper.appendChild(hideBox);

  return wrapper;
}

/**
 * 事実上のリストにlist/listitemの識別タグを付加
 */
function addPceudoType(): void {
  const candidateItems = Array.from(document.querySelectorAll<HTMLElement>('div[role="listitem"], p[role="listitem"]'));

  const groups = new Map<HTMLElement, HTMLElement[]>();

  for (const item of candidateItems) {
    if (item.dataset.pceudotype === 'listitem') continue;

    const parent = item.parentElement;
    if (!parent) continue;

    if (!groups.has(parent)) {
      groups.set(parent, []);
    }
    groups.get(parent)!.push(item);
  }

  for (const [parent, items] of groups) {
    if (items.length >= 5) {
      parent.dataset.pceudotype = 'list';
      for (const item of items) {
        item.dataset.pceudotype = 'listitem';
      }
    }
  }
}

/**
 * トグルボタンとUI追加
 */
function addTogglesToLists(): void {
  const timerName = '[DEBUG] addTogglesToLists';
  console.time(timerName);
  injectHighlightStyle();
  console.timeLog(timerName);
  addPceudoType();
  console.timeLog(timerName);
  const lists = findLists();
  console.timeLog(timerName);

  lists.forEach((list: HTMLElement, index: number) => {
    const id = `list-${index}`;
    list.dataset.listTogglerId = id;

    listSettings.set(id, {
      regex: null,
      highlight: true,
      grayOut: false,
      hide: false,
      matchMode: 'match',
      narrow: false,
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.textContent = 'Hide List';
    toggleBtn.className = 'list-toggle-button';
    toggleBtn.style.marginBottom = '6px';

    let visible = true;
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation()
      visible = !visible;
      list.style.display = visible ? '' : 'none';
      toggleBtn.textContent = visible ? 'Hide List' : 'Show List';
    });

    const controls = createRegexControls(list);
    list.parentNode!.insertBefore(controls, list);
    list.parentNode!.insertBefore(toggleBtn, controls);
  });
  console.timeEnd(timerName);
}

// --- 実行 ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addTogglesToLists);
} else {
  addTogglesToLists();
}
