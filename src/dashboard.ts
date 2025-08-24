import { GlobalSetting } from "./GlobalSetting/GlobalSetting";
import { GlobalSettingManager } from "./GlobalSetting/GlobalSettingManager";

document.addEventListener("DOMContentLoaded", async () => {
  const toggle = document.getElementById("global-toggle") as HTMLInputElement;
  const globalSettingManager = new GlobalSettingManager();

  const setting = await globalSettingManager.load();
  toggle.checked = setting.enabled;

  toggle.addEventListener("change", () => {
    const newSetting: GlobalSetting = { enabled: toggle.checked };
    globalSettingManager.save(newSetting);
  });
});
