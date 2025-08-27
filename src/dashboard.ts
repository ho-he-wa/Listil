// dashboard.ts

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

  // エクスポート
  const exportButton = document.getElementById(
    "export-button"
  ) as HTMLButtonElement;
  exportButton.addEventListener("click", async () => {
    const data = await globalSettingManager.export();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chrome-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  // インポート
  const importFileInput = document.getElementById(
    "import-file"
  ) as HTMLInputElement;
  const importButton = document.getElementById(
    "import-button"
  ) as HTMLButtonElement;
  importButton.addEventListener("click", () => {
    const file = importFileInput.files?.[0];
    if (!file) {
      alert("ファイルを選択してください");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        await globalSettingManager.import(text);
        alert("インポート完了。必要に応じて拡張を再読み込みしてください。");
      } catch (err) {
        alert("読み込んだファイルが不正です。");
      }
    };
    reader.readAsText(file);
  });
});
