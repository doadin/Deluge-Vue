import { defineStore } from "pinia";
import { ref } from "vue";

export const useThemeStore = defineStore("theme", () => {
    const theme = ref(localStorage.getItem("theme") || "auto");

    function applyTheme() {
        let mode = theme.value;

        if (mode === "auto") {
            mode = window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light";
        }

        document.documentElement.setAttribute("data-theme", mode);
    }

    function setTheme(newTheme) {
        theme.value = newTheme;
        localStorage.setItem("theme", newTheme);
        applyTheme();
    }

    applyTheme();

    return { theme, setTheme };
});
