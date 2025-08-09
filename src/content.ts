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

// --- リスト要素を取得 ---
function findLists(): HTMLElement[] {
  const candidateSelectors: string[] = ['main', '[id*="main"]', '[id*="content"]'];
  const seen = new Set<Element>();
  const containers: Element[] = [];

  candidateSelectors.forEach((sel: string) => {
    document.querySelectorAll(sel).forEach((el: Element) => {
      if (!seen.has(el)) {
        seen.add(el);
        containers.push(el);
      }
    });
  });

  const excludeSelector = 'nav, footer, header, #nav, #footer, #header';
  const lists: HTMLElement[] = [];

  containers.forEach((container: Element) => {
    const nodeList = container.querySelectorAll<HTMLElement>('ul, ol, table');
    const foundLists = [...Array.from(nodeList)].filter((el: HTMLElement) => {
      if (el.closest(excludeSelector)) return false;
      if (hasExcludedAncestor(el)) return false;

      const tag = el.tagName.toLowerCase();
      if (tag === 'table' || tag === 'tbody') {
        return el.querySelectorAll('tr').length >= 10;
      } else {
        return el.querySelectorAll('li').length >= 10;
      }
    });
    lists.push(...foundLists);
  });

  return [...new Set(lists)];
}

function hasExcludedAncestor(el: Element): boolean {
  const EXCLUDE_SUFFIXES = ['menu', 'Menu', 'nav', 'Nav'];

  let current: Element | null = el;
  while (current) {
    const id = current.id || '';
    const classList = Array.from(current.classList);

    const matches = EXCLUDE_SUFFIXES.some((suffix) => {
      return id.endsWith(suffix) || classList.some(cls => cls.endsWith(suffix));
    });

    if (matches) return true;

    current = current.parentElement;
  }

  return false;
}

// --- ハイライト適用（mark.js使用） ---
function applyHighlights(listId: string | undefined, element: HTMLElement, regex: RegExp | null): void {
  const instance = new Mark(element);
  instance.unmark({
    done: () => {
      if (regex) {
        instance.markRegExp(regex, {
          //separateWordSearch: false,
          className: 'custom-mark',
        });
      }
    }
  });
}

// --- ハイライト除去 ---
function removeHighlights(listId: string | undefined): void {
  if (!listId) return;

  const list = document.querySelector<HTMLElement>(`[data-list-toggler-id="${listId}"]`);
  if (list) {
    const instance = new Mark(list);
    instance.unmark();
  }
}

// --- 各項目の処理 ---
function applyListFilters(list: HTMLElement, settings: ListSettings): void {
  const tag = list.tagName.toLowerCase();
  const items: HTMLElement[] = tag === 'table'
    ? [...Array.from(list.querySelectorAll<HTMLElement>('tr'))]
    : [...Array.from(list.querySelectorAll<HTMLElement>('li'))];

  removeHighlights(list.dataset.listTogglerId);

  items.forEach((item: HTMLElement) => {
    item.style.opacity = '';
    item.style.display = '';

    const text: string = item.innerText;
    const match = settings.regex && settings.regex.test(text);

    const isTarget = settings.regex
      ? settings.matchMode === 'match' ? match : !match
      : false;

    if (isTarget) {
      if (settings.highlight) {
        applyHighlights(list.dataset.listTogglerId, item, settings.regex);
      }
      if (settings.grayOut) {
        item.style.opacity = '0.3';
      }
      if (settings.hide) {
        item.style.display = 'none';
      }
    }
  });
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

// --- コントロール UI 作成 ---
function createRegexControls(list: HTMLElement): HTMLElement {
  const id = list.dataset.listTogglerId!;
  const settings = listSettings.get(id)!;

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
    applyListFilters(list, settings);
  });

  const highlightBox = createCheckbox('Highlight', settings.highlight, (state: boolean) => {
    settings.highlight = state;
    applyListFilters(list, settings);
  });

  const grayOutBox = createCheckbox('GrayOut', settings.grayOut, (state: boolean) => {
    settings.grayOut = state;
    applyListFilters(list, settings);
  });

  const hideBox = createCheckbox('Hide', settings.hide, (state: boolean) => {
    settings.hide = state;
    applyListFilters(list, settings);
  });

  const matchModeGroup = document.createElement('div');
  matchModeGroup.style.display = 'inline-block';
  matchModeGroup.style.marginLeft = '10px';

  matchModeGroup.appendChild(createRadio(`matchmode-${id}`, 'match', true, (val: string) => {
    settings.matchMode = val as MatchMode;
    applyListFilters(list, settings);
  }));

  matchModeGroup.appendChild(createRadio(`matchmode-${id}`, 'not match', false, (val: string) => {
    settings.matchMode = val as MatchMode;
    applyListFilters(list, settings);
  }));

  const wrapper = document.createElement('div');
  wrapper.className = 'list-controls';
  wrapper.style.marginBottom = '10px';

  wrapper.appendChild(input);
  wrapper.appendChild(highlightBox);
  wrapper.appendChild(grayOutBox);
  wrapper.appendChild(hideBox);
  wrapper.appendChild(matchModeGroup);

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
