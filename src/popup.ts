// popup.ts

function getCurrentTabUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }
            const tab = tabs[0];
            if (tab && tab.url) {
                resolve(tab.url);
            } else {
                reject('No active tab found.');
            }
        });
    });
}

function getSettingKey(url: string): string {
    const u = new URL(url);
    return `pageSetting:${u.origin}`; // ページ単位で設定
}

function loadSetting(url: string): Promise<boolean> {
    const key = getSettingKey(url);
    return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
            resolve(result[key]?.enabled ?? false);
        });
    });
}

function saveSetting(url: string, enabled: boolean): void {
    const key = getSettingKey(url);
    chrome.storage.local.set({
        [key]: { enabled }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const toggle = document.getElementById('toggle-setting') as HTMLInputElement;
    const globalBtn = document.getElementById('global-settings-btn') as HTMLButtonElement;

    try {
        const url = await getCurrentTabUrl();
        const enabled = await loadSetting(url);
        toggle.checked = enabled;

        toggle.addEventListener('change', () => {
            saveSetting(url, toggle.checked);
        });

        globalBtn.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });
    } catch (error) {
        console.error(error);
    }
});
