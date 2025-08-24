export class PageSettingKeyManager {
  private keys: string[];
  public constructor(keys: string[]) {
    this.keys = keys;
  }
  public static createKey(urlOrUrlPattern: string) {
    const key = `pageSetting:${urlOrUrlPattern}`;
    return key;
  }
  public findKeys(url: string): string[] {
    const keys = [];
    const fullKey = PageSettingKeyManager.createKey(url);
    if (this.keys.includes(fullKey)) {
      keys.push(fullKey);
    }
    for (const key of this.keys) {
      const patternInKey = key.replace(/^pageSetting:/, "");
      if (url.match(new RegExp(patternInKey))) {
        keys.push(key);
      }
    }
    return keys;
  }
  public static isPageSettingKey(key: string) {
    return key.startsWith("pageSetting:");
  }
}
