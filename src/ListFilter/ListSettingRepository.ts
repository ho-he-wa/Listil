import { defaultSetting } from "@/ListFilter/defaultSetting";
import {
  FilterSettingInterface,
  FilterSettingSet,
  ListSettingInterface,
  SerializedFilterSettingInterface,
} from "@/ListFilter/Interface";

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
      name: serialized.name,
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
}
