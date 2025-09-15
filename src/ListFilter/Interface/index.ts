/**
 * フィルタ設定インタフェース
 */
export interface FilterSettingInterface {
  regex: RegExp | null;
  criterion: string;
  marker: boolean;
  markerColor: string;
  invertMarkerColor: string;
  highlight: boolean;
  grayOut: boolean;
  hide: boolean;
  invertMatch: boolean;
  narrow: boolean;
}
/**
 * フィルタ設定インタフェース(シリアライズド)
 */
export interface SerializedFilterSettingInterface {
  regexSource: string | null;
  regexFlags: string | null;
  criterion: string;
  marker: boolean;
  markerColor: string;
  invertMarkerColor: string;
  highlight: boolean;
  grayOut: boolean;
  hide: boolean;
  invertMatch: boolean;
  narrow: boolean;
}
export interface FilterSettingList<
  T extends
    | FilterSettingInterface
    | SerializedFilterSettingInterface = FilterSettingInterface
> {
  name?: string;
  list: T[];
}
/**
 * フィルタ設定セット
 */
export type FilterSettingSet<
  T extends
    | FilterSettingInterface
    | SerializedFilterSettingInterface = FilterSettingInterface
> = {
  [key: string]: FilterSettingList<T>;
};
/**
 * リスト設定インタフェース
 */
export interface ListSettingInterface<
  T extends
    | FilterSettingInterface
    | SerializedFilterSettingInterface = FilterSettingInterface
> {
  name?: string;
  listId: string;
  filterSettingSet: FilterSettingSet<T>;
}
