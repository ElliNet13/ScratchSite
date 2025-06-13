// Trigger the green flag automatically when the project loads
window.addEventListener('load', () => {
  setTimeout(() => {
    if (window.scaffolding?.greenFlag) {
      window.scaffolding.greenFlag();
    }
  }, 100);  // Adjust delay if needed
});
