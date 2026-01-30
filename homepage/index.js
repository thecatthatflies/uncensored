// Event listener for theme switcher buttons
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".switcher span[id^='theme-']").forEach((button) => {
        button.addEventListener("click", (e) => {
            const theme = e.target.id.replace("theme-", "");
            ThemeManager.setTheme(theme);
        });
    });
});