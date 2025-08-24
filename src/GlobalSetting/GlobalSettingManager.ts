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
}
