const defaults = { enabled: true, expanded: true };
chrome.storage.local.get(defaults, settings => {
  for (const key of Object.keys(defaults)) document.getElementById(key).checked = !!settings[key];
});
for (const key of Object.keys(defaults)) {
  document.getElementById(key).addEventListener('change', event => {
    chrome.storage.local.set({ [key]: event.target.checked });
  });
}
