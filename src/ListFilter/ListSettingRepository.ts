import { defaultSetting } from "@/ListFilter/defaultSetting";
import {
  FilterSettingInterface,
  FilterSettingSet,
  ListSettingInterface,
  SerializedFilterSettingInterface,
} from "@/ListFilter/Interface";
import { KeyPrefix } from "@/ListFilter/KeyPrefix";
import { mergeListSettings } from "@/ListFilter/mergeListSettings";
import { LikeExp } from "@/RegExp/LikeExp";

export class ListSettingRepository {
  /**
   * 保存
   */
  public save(key: string, setting: ListSettingInterface): void {
    const serialized = this.serializeListSetting(setting);
    chrome.storage.local.set({ [key]: serialized }, () => {
      console.log(`[listil] Saved list setting for ${key}`);
    });
  }

  /**
   * 復元
   */
  public async restore(key: string): Promise<ListSettingInterface | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        if (result[key]) {
          try {
            const deserialized = this.deserializeListSetting(result[key]);
            resolve(deserialized);
          } catch (e) {
            // デシリアライズ失敗
            console.warn("[Listil] 保存データのデシリアライズ失敗", e);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * 設定のシリアライズ（ListSettingInterface → JSON）
   */
  private serializeListSetting(
    setting: ListSettingInterface
  ): ListSettingInterface<SerializedFilterSettingInterface> {
    const serializedFilterSettingSet: FilterSettingSet<SerializedFilterSettingInterface> =
      {};
    for (const key in setting.filterSettingSet) {
      serializedFilterSettingSet[key] = {
        name: setting.filterSettingSet[key].name ?? undefined,
        list: setting.filterSettingSet[key].list.map(
          this.serializeFilterSetting
        ),
      };
    }
    return {
      name: setting.name,
      listId: setting.listId,
      filterSettingSet: serializedFilterSettingSet,
    };
  }

  /**
   * 設定のデシリアライズ（JSON → ListSettingInterface）
   */
  private deserializeListSetting(
    serialized: ListSettingInterface<SerializedFilterSettingInterface>
  ): ListSettingInterface {
    const deserializedFilterSettingSet: FilterSettingSet = {};
    for (const key in serialized.filterSettingSet) {
      const filterSetting = serialized.filterSettingSet[key];
      deserializedFilterSettingSet[key] = {
        name: filterSetting.name ?? undefined,
        list: Array.isArray(filterSetting.list)
          ? filterSetting.list.map(this.deserializeFilterSetting)
          : [],
      };
    }
    return {
      ...serialized,
      filterSettingSet: deserializedFilterSettingSet,
    };
  }

  /**
   * 個別フィルタ設定のシリアライズ
   */
  private serializeFilterSetting(
    setting: FilterSettingInterface
  ): SerializedFilterSettingInterface {
    // [x] TODO criterionも対象にする
    return {
      regexSource: setting.regex ? setting.regex.source : null,
      regexFlags: setting.regex ? setting.regex.flags : null,
      criterion: setting.criterion,
      marker: setting.marker,
      markerColor: setting.markerColor,
      invertMarkerColor: setting.invertMarkerColor,
      highlight: setting.highlight,
      grayOut: setting.grayOut,
      hide: setting.hide,
      invertMatch: setting.invertMatch,
      narrow: setting.narrow,
    };
  }

  /**
   * 個別フィルタ設定のデシリアライズ
   */
  private deserializeFilterSetting(
    serialized: SerializedFilterSettingInterface
  ): FilterSettingInterface {
    let regex: RegExp | null = null;
    try {
      if (serialized.regexSource && serialized.regexFlags !== null) {
        regex = new RegExp(serialized.regexSource, serialized.regexFlags);
      }
    } catch (e) {
      console.error("[listil] 正規表現の復元に失敗しました", e);
      throw e;
    }
    // [x] TODO criterionも対象にする
    return {
      regex,
      criterion: serialized.criterion,
      marker: serialized.marker,
      markerColor: serialized.markerColor ?? defaultSetting.markerColor,
      invertMarkerColor:
        serialized.invertMarkerColor ?? defaultSetting.invertMarkerColor,
      highlight: serialized.highlight,
      grayOut: serialized.grayOut,
      hide: serialized.hide,
      invertMatch: serialized.invertMatch,
      narrow: serialized.narrow,
    };
  }

  public async changeKeys(oldUrlPattern: string, newUrlPattern: string) {
    const oldKeyRegex = LikeExp.of(
      `${KeyPrefix.listSettings}${oldUrlPattern}#*`
    ).toRegExp();
    const entries = await this.getEntriesByPredicate((key, value) => {
      return key.match(oldKeyRegex) !== null;
    });
    if (entries.length === 0) {
      console.warn(`No keys matched for pattern: "${oldUrlPattern}"`);
      return;
    }
    for (const [oldKey, value] of entries) {
      const newKey = oldKey.replace(oldUrlPattern, newUrlPattern);
      // キー重複時はデータを統合する
      if (await this.exists(newKey)) {
        const oldRecord = await this.get(oldKey);
        const newRecord = await this.get(newKey);
        const merged = mergeListSettings(oldRecord[oldKey], newRecord[newKey]);
        await chrome.storage.local.remove(oldKey);
        await chrome.storage.local.set({ [newKey]: merged });
        return;
      }
      this.replaceKey(oldKey, newKey);
    }
  }

  public static createKey(urlOrUrlPattern: string) {
    const key = `${KeyPrefix.listSettings}${urlOrUrlPattern}`;
    return key;
  }

  private async getEntriesByPredicate(
    predicate: (key: string, value?: any) => boolean
  ) {
    const record: Record<string, ListSettingInterface> =
      await chrome.storage.local.get();
    // entriesで[key, value]を取得して、キーだけfilterして配列化
    return Object.entries(record)
      .filter(([key, _]) => key.startsWith(KeyPrefix.listSettings))
      .filter(([key, value]) => predicate(key, value));
  }

  private async replaceKey(oldKey: string, newKey: string): Promise<void> {
    const record = await this.get(oldKey);
    if (!(oldKey in record)) {
      console.warn("The key is not found in a storage.", oldKey, record);
      throw new Error(`The key"${oldKey}" is not found.`);
    }
    const value = record[oldKey];
    await chrome.storage.local.remove(oldKey);
    await chrome.storage.local.set({ [newKey]: value });
  }

  /**
   * 指定したキーがchrome.storage.localに存在するかチェックする関数
   * @param key チェックしたいキー名
   * @returns 存在すればtrue、なければfalseを返す
   */
  private async exists(key: string): Promise<boolean> {
    const record = await this.get(key);
    return key in record;
  }

  private async get(key: string) {
    if (!key.startsWith(KeyPrefix.listSettings)) {
      // リスト設定以外のキーであれば無視
      return {};
    }
    const record: Record<string, ListSettingInterface> =
      await chrome.storage.local.get(key);
    return record;
  }
}
