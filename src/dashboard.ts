const GLOBAL_SETTING_KEY = 'globalSetting';

interface GlobalSetting {
  enabled: boolean;
}

function loadGlobalSetting(): Promise<GlobalSetting> {
  return new Promise((resolve) => {
    chrome.storage.local.get([GLOBAL_SETTING_KEY], (result) => {
      const setting = result[GLOBAL_SETTING_KEY] as GlobalSetting | undefined;
      resolve(setting ?? { enabled: true }); // デフォルトは有効
    });
  });
}

function saveGlobalSetting(setting: GlobalSetting): void {
  chrome.storage.local.set({
    [GLOBAL_SETTING_KEY]: setting,
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('global-toggle') as HTMLInputElement;

  const setting = await loadGlobalSetting();
  toggle.checked = setting.enabled;

  toggle.addEventListener('change', () => {
    const newSetting: GlobalSetting = { enabled: toggle.checked };
    saveGlobalSetting(newSetting);
  });
});
