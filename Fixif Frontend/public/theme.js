(function () {
    const STORAGE_KEY = "wrench-theme";

    function getPreferredTheme() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") return stored;

        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            return "dark";
        }
        return "light";
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem(STORAGE_KEY, theme);
        updateToggleButtons(theme);
    }

    function updateToggleButtons(theme) {
        const isDark = theme === "dark";
        document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
            btn.setAttribute("aria-pressed", isDark ? "true" : "false");
            const iconSpan = btn.querySelector(".theme-toggle-icon");
            const labelSpan = btn.querySelector(".theme-toggle-label");
            if (iconSpan && labelSpan) {
                if (isDark) {
                    iconSpan.textContent = "☀️";
                    labelSpan.textContent = "Light mode";
                } else {
                    iconSpan.textContent = "🌙";
                    labelSpan.textContent = "Dark mode";
                }
            }
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        // Initial theme
        const initialTheme = getPreferredTheme();
        document.documentElement.setAttribute("data-theme", initialTheme);
        updateToggleButtons(initialTheme);

        // Toggle click handler
        document.addEventListener("click", (event) => {
            const toggleBtn = event.target.closest("[data-theme-toggle]");
            if (!toggleBtn) return;

            const current = document.documentElement.getAttribute("data-theme") === "dark"
                ? "dark"
                : "light";
            const next = current === "dark" ? "light" : "dark";
            applyTheme(next);
        });

        // Mobile nav
        const navToggle = document.querySelector("[data-nav-toggle]");
        const nav = document.querySelector(".site-nav");
        if (navToggle && nav) {
            navToggle.addEventListener("click", () => {
                const isOpen = nav.classList.toggle("is-open");
                navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
            });
        }
    });
})();
