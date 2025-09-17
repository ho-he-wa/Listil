import {
  FilterSettingInterface,
  FilterSettingList,
  SerializedFilterSettingInterface,
} from "@/ListFilter/Interface";

/**
 * フィルタ設定をマージする
 */

export function mergeFilterSettingList<
  T extends FilterSettingInterface | SerializedFilterSettingInterface
>(
  baseList: FilterSettingList<T>,
  overrideList: Partial<FilterSettingList<T>>
): FilterSettingList<T> {
  return {
    ...baseList,
    ...overrideList,
    list: [...baseList.list, ...(overrideList.list ?? [])], // listを結合（追記）
  };
}
