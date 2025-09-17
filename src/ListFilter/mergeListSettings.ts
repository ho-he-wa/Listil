import {
  FilterSettingInterface,
  ListSettingInterface,
  SerializedFilterSettingInterface,
} from "@/ListFilter/Interface";
import { mergeFilterSettingSet } from "@/ListFilter/mergeFilterSettingSet";

/**
 * リスト設定をマージする
 */

export function mergeListSettings<
  T extends FilterSettingInterface | SerializedFilterSettingInterface
>(
  base: ListSettingInterface<T>,
  override: Partial<ListSettingInterface<T>>
): ListSettingInterface<T> {
  const merged: ListSettingInterface<T> = {
    ...base,
    ...override,
    filterSettingSet: mergeFilterSettingSet(
      base.filterSettingSet,
      override.filterSettingSet || {}
    ),
  };

  return merged;
}
