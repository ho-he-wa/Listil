import { GlobalSetting } from "./GlobalSetting";

export const GLOBAL_SETTING_KEY = "globalSetting";

export class GlobalSettingManager {
  public load(): Promise<GlobalSetting> {
    return new Promise((resolve) => {
      chrome.storage.local.get([GLOBAL_SETTING_KEY], (result) => {
        const setting = result[GLOBAL_SETTING_KEY] as GlobalSetting | undefined;
        resolve(setting ?? { enabled: true });
      });
    });
  }
  public save(setting: GlobalSetting): void {
    chrome.storage.local.set({
      [GLOBAL_SETTING_KEY]: setting,
    });
  }
  /**
   * export all settings.
   */
  public async export() {
    const data = await chrome.storage.local.get(null);
    return data;
  }
  /**
   * import settings.
   */
  public async import(text: string) {
    const json = JSON.parse(text);
    await chrome.storage.local.set(json);
  }
}
