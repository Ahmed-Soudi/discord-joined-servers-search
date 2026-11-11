const defaults = { enabled: true, showListByDefault: false };
chrome.storage.local.get(defaults, settings => {
  for (const key of Object.keys(defaults)) document.getElementById(key).checked = settings[key] === true;
});
for (const key of Object.keys(defaults)) {
  document.getElementById(key).addEventListener('change', event => {
    chrome.storage.local.set({ [key]: event.target.checked });
  });
}
document.getElementById('resetPosition').addEventListener('click', () => {
  chrome.storage.local.remove('panelPosition', () => {
    const button = document.getElementById('resetPosition');
    button.textContent = 'Position reset';
  });
});
