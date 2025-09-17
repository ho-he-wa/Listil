import {
  FilterSettingInterface,
  FilterSettingSet,
  SerializedFilterSettingInterface,
} from "@/ListFilter/Interface";
import { mergeFilterSettingList } from "@/ListFilter/mergeFilterSettingList";

/**
 * フィルタ設定セットをマージする
 */

export function mergeFilterSettingSet<
  T extends FilterSettingInterface | SerializedFilterSettingInterface
>(
  baseSet: FilterSettingSet<T>,
  overrideSet: Partial<FilterSettingSet<T>>
): FilterSettingSet<T> {
  const result: FilterSettingSet<T> = { ...baseSet };

  for (const key of Object.keys(overrideSet)) {
    if (baseSet == null) {
      continue;
    }
    if (key in baseSet) {
      // // キーが同じフィルタ設定セットがあるならばマージする
      // result[key] = mergeFilterSettingList(baseSet[key], overrideSet[key]!);
      // NOTE : マージするとフィルタ設定が混ざってしまうので意図しないフィルタ設定となってしまう
      // キーが同じフィルタ設定セットがあるならば別のキーにしてコピー
      result[`setting_${Date.now()}`] = overrideSet[key]!;
      continue;
    }
    // overrideSet側にのみあるならば単純にコピー
    result[key] = overrideSet[key]!;
  }

  return result;
}
