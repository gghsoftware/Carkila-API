// Smooth year in footer
document.addEventListener("DOMContentLoaded", () => {
    const yearEl = document.getElementById("year");
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
});

// Mobile nav toggle
const navToggle = document.querySelector(".nd-nav-toggle");
const nav = document.querySelector(".nd-nav");

if (navToggle && nav) {
    navToggle.addEventListener("click", () => {
        nav.classList.toggle("nd-nav--open");
    });
}

// Simple toast notification
const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toast-message");

function showToast(message, duration = 2600) {
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    toast.classList.add("nd-toast--visible");

    setTimeout(() => {
        toast.classList.remove("nd-toast--visible");
    }, duration);
}

// Example questions per use-case
document.querySelectorAll(".nd-link-button[data-model]").forEach((btn) => {
    btn.addEventListener("click", () => {
        const model = btn.getAttribute("data-model");
        let msg = "Sample questions: ";

        if (model === "Daily Drivers") {
            msg += "“What does this warning light mean?”, “What maintenance do I need at 80k km?”";
        } else if (model === "Mechanics & Shops") {
            msg += "“Give me a checklist for brake noise diagnostics”, “Explain this repair to a customer.”";
        } else if (model === "Fleets & Operators") {
            msg += "“Summarize reported issues for Vehicle #12”, “Create a daily inspection checklist.”";
        } else {
            msg += "Ask anything about your car’s issues, symptoms, or maintenance.";
        }

        showToast(msg, 4200);
    });
});

// Request access form (fake submit)
const reservationForm = document.getElementById("reservation-form");

if (reservationForm) {
    reservationForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const userType = reservationForm.userType?.value || "car user";

        showToast(`Request received. We’ll email you when Fixif AI is ready for ${userType}.`, 3200);
        reservationForm.reset();
    });
}
