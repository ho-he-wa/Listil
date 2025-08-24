import { PageSettingKeyManager } from "./PageSettingKeyManager";
import { PageSettingType } from "./PageSettingType";

export class PageSettingManager {
  private storage;
  constructor() {
    this.storage = chrome.storage.local;
  }
  public async find(key: string) {
    const allSettings = await this.getAll();
    return allSettings[key] ?? undefined;
  }
  public async findKeyByUrl(url: string) {
    const matchedSettings = await this.findAllByUrl(url);
    if (Object.values(matchedSettings).length === 0) {
      return undefined;
    }
    return Object.keys(matchedSettings)[0];
  }
  public async findByUrl(url: string) {
    const matchedSettings = await this.findAllByUrl(url);
    if (Object.values(matchedSettings).length === 0) {
      return undefined;
    }
    return Object.values(matchedSettings)[0];
  }
  public async findAllByUrl(url: string) {
    const allSettings = await this.getAll();
    const matchedKeys = new PageSettingKeyManager(
      Object.keys(allSettings)
    ).findKeys(url);
    const entries = Object.fromEntries(
      Object.entries(allSettings).filter(([key]) => matchedKeys.includes(key))
    );
    return entries;
  }
  public async getKeys() {
    const allSettings = await this.getAll();
    return Object.keys(allSettings);
  }
  public getAll(): Promise<Record<string, PageSettingType>> {
    return new Promise((resolve) => {
      this.storage.get(null, (items) => {
        const settings: Record<string, PageSettingType> = {};
        for (const key in items) {
          if (!key.startsWith("pageSetting:")) {
            continue;
          }
          settings[key] = items[key];
        }
        resolve(settings);
      });
    });
  }
  public save(key: string, data: object) {
    this.storage.set(
      {
        [key]: data,
      },
      () => {
        console.log("保存", key, data);
      }
    );
  }
  public remove(key: string) {
    this.storage.remove(key);
  }
}
