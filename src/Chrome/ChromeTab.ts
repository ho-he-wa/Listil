export class ChromeTab {
  public constructor(public readonly tab: chrome.tabs.Tab) {}
  public static async asyncCurrentTab() {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const tab = tabs[0] ?? null;
    return new this(tab);
  }
  public getId() {
    const tab = this.tab;
    if (tab == null || tab.id == null) {
      throw Error("タブの URL を取得できません");
    }
    if (!tab.url || isRestrictedUrl(tab.url ?? "")) {
      throw Error(`このページには content script を注入できません:${tab.url}`);
    }
    return tab.id;
  }
  public sendData<DataT extends object, TypeT extends string>(
    type: string,
    data: DataT,
    done?: (response: any) => void,
    failed?: (response: any, lastError: chrome.runtime.LastError) => void
  ) {
    this.sendMessage({ type: type, data: data }, done, failed);
  }
  public sendMessage(
    message: object,
    done?: (response: any) => void,
    failed?: (response: any, lastError: chrome.runtime.LastError) => void
  ) {
    chrome.tabs.sendMessage(this.getId(), message, (res) => {
      if (chrome.runtime.lastError) {
        failed && failed(res, chrome.runtime.lastError);
      } else {
        done && done(res);
      }
    });
  }
}

/**
 *
 * @param url
 * @returns
 * @see https://chromeenterprise.google/intl/ja_jp/policies/url-patterns/ chrome suppoted schemes
 */
export function isRestrictedUrl(url: string) {
  // const isAllowedUrl =
  //   url.startsWith("http://") ||
  //   url.startsWith("https://") ||
  //   url.startsWith("file://");
  // return !isAllowedUrl;
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("devtools://") ||
    url.startsWith("about:") ||
    url.startsWith("edge://")
  );
}
