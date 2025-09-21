type CountMap = Record<string, number>;

/**
 * 事実上のリスト要素を推定するためのサマリー
 */
export class HtmlElementSummary {
  public constructor(private readonly elements: HTMLElement[]) {
    const summary = {
      tagCount: this.tagCount(),
      classCount: this.classCount(),
    };
    const mostUsedTag = this.mostUsedTag();
    const mostUsedClass = this.mostUsedClass();
    console.log("DEBUG", "summary", summary, mostUsedTag, mostUsedClass);
  }
  private summaryCache:
    | { tagCount: CountMap; classCount: CountMap }
    | undefined = undefined;

  /**
   * 推定リスト要素群
   */
  public maybeListItems() {
    const listItems = this.elements.filter((element) => {
      const mostUsedTag = this.mostUsedTag();
      const mostUsedClass = this.mostUsedClass();
      const elementTagName = element.tagName.toLowerCase();
      if (!mostUsedTag) {
        return false;
      }
      if (mostUsedTag.name.includes("-")) {
        // 最頻出のタグ名の要素がカスタム要素 (タグ名に-を含む) であれば、そのタグ名と一致していればリスト要素とする
        return elementTagName === mostUsedTag.name;
      }
      if (!mostUsedClass || mostUsedClass.rate < 0.25) {
        // 最も多いクラス名のレートが0.25未満であれば、最頻出のタグ名と一致すればリスト要素とする
        return elementTagName === mostUsedTag.name;
      }
      // 最頻出のタグ名と一致かつそのクラス名を含む要素をリスト要素とする
      return (
        elementTagName === mostUsedTag.name &&
        element.className.includes(mostUsedClass.name)
      );
    });
    return listItems;
  }

  private tagCount() {
    return this.summarizeElements().tagCount;
  }
  private classCount() {
    return this.summarizeElements().classCount;
  }

  private mostUsedTag() {
    const summary = this.summarizeElements();
    return this.getMostFrequent(summary.tagCount);
  }
  private mostUsedClass() {
    const summary = this.summarizeElements();
    return this.getMostFrequent(summary.classCount);
  }

  private summarizeElements() {
    if (this.summaryCache) {
      return this.summaryCache;
    }
    const tagCount: CountMap = {};
    const classCount: CountMap = {};
    this.elements.forEach((el: HTMLElement) => {
      // タグ名ごとのカウント
      const tag = el.tagName.toLowerCase();
      tagCount[tag] = (tagCount[tag] || 0) + 1;
      // クラス名ごとのカウント
      el.classList.forEach((className: string) => {
        if (className.includes("listil-")) {
          // Listil系クラスは無視。あくまで元のページ要素で評価するため
          return;
        }
        classCount[className] = (classCount[className] || 0) + 1;
      });
    });
    this.summaryCache = { tagCount, classCount };
    return this.summaryCache;
  }

  private getMostFrequent(
    countMap: Record<string, number>
  ): { name: string; count: number; rate: number } | null {
    let maxCount = 0;
    let mostFrequent: string | null = null;
    for (const [name, count] of Object.entries(countMap)) {
      if (count > maxCount) {
        maxCount = count;
        mostFrequent = name;
      }
    }
    return mostFrequent
      ? {
          name: mostFrequent,
          count: maxCount,
          rate: this.count() > 0 ? maxCount / this.count() : NaN,
        }
      : null;
  }
  private count() {
    return this.elements.length;
  }
}
