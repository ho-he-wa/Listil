import { FilterSettingInterface } from "./Interface";

// 初期デフォルト設定
export const defaultSetting: FilterSettingInterface = {
  regex: null,
  criterion: "",
  marker: true,
  markerColor: "listil-custom-mark-yellow",
  invertMarkerColor: "listil-custom-mark-purple",
  highlight: false,
  grayOut: false,
  hide: false,
  invertMatch: false,
  narrow: false,
};
