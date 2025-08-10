import Mark from "mark.js";

console.log("[DEBUG] Content script loaded (mark.js version)");

// --- 型定義 ---
type MatchMode = 'match' | 'not match';

interface ListSettings {
  regex: RegExp | null;
  highlight: boolean;
  grayOut: boolean;
  hide: boolean;
  matchMode: MatchMode;
}

// --- グローバル状態 ---
const listSettings = new Map<string, ListSettings>(); // listId -> settings

// --- スタイル追加（mark.js用） ---
function injectHighlightStyle(): void {
  const style = document.createElement('style');
  style.textContent = `
    mark.custom-mark {
      background-color: yellow;
      color: black;
    }
  `;
  document.head.appendChild(style);
}

/**
 * リストの検索処理
 */
class ListFinder {
  private excludeSelector = 'nav, footer, header, #nav, #footer, #header';
  private excludeSuffixes = ['menu', 'Menu', 'nav', 'Nav'];
  private contentSelectors = ['main', '[id*="main"]', '[id*="content"]'];

  constructor() {
  }

  public findLists(): HTMLElement[] {
    const containers = this.findContentContainers();
    const lists: HTMLElement[] = [];

    containers.forEach(container => {
      const listElements = container.querySelectorAll<HTMLElement>('ul, ol, table');

      listElements.forEach(list => {
        if (!this.isEligibleList(list)) return;
        lists.push(list);
      });
    });

    return [...new Set(lists)];
  }

  private findContentContainers(): Element[] {
    const seen = new Set<Element>();
    const result: Element[] = [];

    this.contentSelectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!seen.has(el)) {
          seen.add(el);
          result.push(el);
        }
      });
    });

    if (result.length === 0) {
      result.push(document.body);
    }

    return result;
  }

  private isEligibleList(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();

    if (el.closest(this.excludeSelector)) return false;
    if (this.hasExcludedAncestor(el)) return false;

    if (tag === 'table') {
      return el.querySelectorAll('tr').length >= 10;
    } else if (tag === 'ul' || tag === 'ol') {
      return el.querySelectorAll('li').length >= 10;
    }

    return false;
  }

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
  const finder = new ListFinder();
  const lists = finder.findLists();
  return lists;
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
    const tag = this.list.tagName.toLowerCase();
    const items: HTMLElement[] = tag === 'table'
      ? [...Array.from(this.list.querySelectorAll<HTMLElement>('tr'))]
      : [...Array.from(this.list.querySelectorAll<HTMLElement>('li'))];

    this.removeHighlights();

    items.forEach((item: HTMLElement) => {
      item.style.opacity = '';
      item.style.display = '';

      const text: string = item.innerText;
      const match = this.settings.regex && this.settings.regex.test(text);

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

// --- チェックボックス ---
function createCheckbox(label: string, checked: boolean, onChange: (checked: boolean) => void): HTMLElement {
  const wrapper = document.createElement('label');
  wrapper.style.marginRight = '8px';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = checked;
  checkbox.style.marginRight = '4px';

  checkbox.addEventListener('change', () => {
    onChange(checkbox.checked);
  });

  wrapper.appendChild(checkbox);
  wrapper.appendChild(document.createTextNode(label));
  return wrapper;
}

// --- ラジオボタン ---
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

  radio.addEventListener('change', () => {
    if (radio.checked) {
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

  input.addEventListener('input', () => {
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
  wrapper.appendChild(hideBox);

  return wrapper;
}

// --- トグルボタンとUI追加 ---
function addTogglesToLists(): void {
  injectHighlightStyle();
  const lists = findLists();

  lists.forEach((list: HTMLElement, index: number) => {
    const id = `list-${index}`;
    list.dataset.listTogglerId = id;

    listSettings.set(id, {
      regex: null,
      highlight: true,
      grayOut: false,
      hide: false,
      matchMode: 'match',
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.textContent = 'Hide List';
    toggleBtn.className = 'list-toggle-button';
    toggleBtn.style.marginBottom = '6px';

    let visible = true;
    toggleBtn.addEventListener('click', () => {
      visible = !visible;
      list.style.display = visible ? '' : 'none';
      toggleBtn.textContent = visible ? 'Hide List' : 'Show List';
    });

    const controls = createRegexControls(list);
    list.parentNode!.insertBefore(controls, list);
    list.parentNode!.insertBefore(toggleBtn, controls);
  });
}

// --- 実行 ---
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addTogglesToLists);
} else {
  addTogglesToLists();
}
