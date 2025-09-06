import { CriterionInterface } from "./CriterionInterface";
import { CriterionUtility } from "./CriterionUtility";

export class DispCriterion implements CriterionInterface {
  public readonly hint;
  public readonly option;
  public readonly operator;
  public readonly value;
  private readonly hintRegExp;
  public constructor(params: {
    hint: string;
    option: string;
    operator: string;
    value: string;
  }) {
    this.hint = params.hint;
    this.option = params.option;
    this.operator = params.operator;
    this.value = params.value;
    this.hintRegExp = DispCriterion.tryCreateRegExp(params.hint, "giu");
    console.log(this);
  }

  public static from(str: string) {
    console.log("DEBUG", `DispCriterion.from('${str}')`);
    const matches = str.match(
      /^(\*d:)(\S+?)\s*(\(\S*\))?\s*(==|!=|>=|<=|=|>|<)\s*(.+)/
    );
    if (!matches) {
      throw new Error("invalid hint criterion.");
    }
    return new this({
      hint: matches[2].trim(),
      option: (matches[3] ?? "").replace(/^\(|\)$/g, ""),
      operator: matches[4].trim(),
      value: matches[5].trim(),
    });
  }

  public existsIn(element: HTMLElement): boolean {
    return !!this.findIn(element);
  }

  public findIn(element: HTMLElement): HTMLElement | undefined {
    console.log("DEBUG", `DispCriterion.findIn(...)`);
    if (element instanceof HTMLTableRowElement) {
      // table要素に遡り、thを検索。this.hintが部分一致するthの列順番を導出。element(=tr)のうち該当する列順番を抽出して評価する。
      const targetColIndex = this.matchedThIndex(element);
      if (targetColIndex >= 0) {
        const existsInTr = this.pickTdAt(element, targetColIndex);
        if (existsInTr) {
          return existsInTr;
        }
      }
      // thに見つからない場合は後続のtr以外と同じ処理へ
    }
    // element配下でthis.hintが部分一致する要素を抽出。その親要素を評価する。
    const matchedDescendants = Array.from(element.querySelectorAll("*"))
      .filter((el) => el instanceof HTMLElement)
      .filter((el) => el.style.display !== "none") // 非表示は除外
      .filter((el) => !this.not_text_tags.includes(el.tagName.toLowerCase()))
      .map((el) => {
        // textContentのアクセス回数を減らすためテキストを保持
        return {
          text: el.textContent?.trim() ?? "",
          el: el,
        };
      })
      .filter((item) => item.text.length >= 1 && item.text.length <= 200) // テキストなしは除外。またパフォーマンスを考慮して一定サイズ以上のテキストも除外(数値抽出の納得感も落ちるため)
      .filter((item) => this.hintMatch(item.text))
      .sort((a, b) => {
        // 長さの昇順
        return a.text.length - b.text.length;
      });
    for (const item of matchedDescendants) {
      console.log("DEBUG", "not td", item.text);
      if (this.matchValue(item.text)) {
        console.log("DEBUG", "matched:", item.text);
        return item.el;
      }
    }
    return undefined;
  }

  private not_text_tags = [
    "style",
    "script",
    "template",
    // media
    "img",
    "audio",
    "video",
    "track",
    "source",
    // 埋め込み
    "object",
    "embed",
    "iframe",
    "canvas",
    "picture",
    "map",
    "area",
  ];

  private pickTdAt(
    tr: HTMLTableRowElement,
    targetColIndex: number
  ): HTMLTableCellElement | undefined {
    const tdList = Array.from(tr.querySelectorAll("td"));
    const targetTd = tdList[targetColIndex] ?? undefined;
    if (!targetTd) {
      return undefined;
    }
    console.log("DEBUG", "td", targetTd.textContent);
    if (!this.matchValue(targetTd.textContent?.trim() ?? "")) {
      console.log("DEBUG", "matched:", targetTd.textContent);
      return undefined;
    }
    return tdList[targetColIndex];
  }

  private matchedThIndex(element: HTMLElement): number {
    if (!(element instanceof HTMLTableRowElement)) {
      return -3;
    }
    const tr = element;
    const table = tr.closest("table");
    if (!table) {
      return -2;
    }
    // theadがあれば、その最初のtrを使用。theadがない場合は、最初のtrをヘッダーとする（tbodyを除く）
    const thead = table.querySelector("thead");
    const headerRow = thead?.querySelector("tr") ?? table.querySelector("tr");
    if (!headerRow) {
      return -4;
    }
    // 3. this.hint に部分一致する列インデックスを探す
    const thList = Array.from(headerRow.querySelectorAll("th"));
    const targetColIndex = thList.findIndex((th) =>
      this.hintMatch(th.textContent)
    );
    return targetColIndex;
  }

  public matchValue(value: string): boolean {
    const util = new CriterionUtility();
    return util.match(value, this.operator, this.value);
  }

  private hintMatch(text: string | undefined) {
    if (this.hintRegExp) {
      return text?.match(this.hintRegExp) ?? false;
    }
    return text?.includes(this.hint) ?? false;
  }

  private static tryCreateRegExp(pattern: string, flags: string) {
    try {
      return new RegExp(pattern, flags);
    } catch (e) {
      if (e instanceof SyntaxError) {
        return undefined;
      }
      throw e;
    }
  }
}

// if (import.meta?.env == null || import.meta.env.DEV) {
//   const eq100yen = DispCriterion.from("*d:あいうえお <= 100円");
//   console.log(eq100yen.matchValue("100"));
//   console.log(eq100yen.matchValue("101"));
// }
