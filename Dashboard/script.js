document.addEventListener("DOMContentLoaded", () => {
  const yearElement = document.getElementById("year");
  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener("click", (event) => {
        const targetId = link.getAttribute("href");
        if (!targetId || targetId === "#") {
          return;
        }
        const target = document.getElementById(targetId.slice(1));
        if (target) {
          event.preventDefault();
          const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
          ).matches;
          target.scrollIntoView({
            behavior: reducedMotion ? "auto" : "smooth",
            block: "start"
          });
        }
      });
    });
  const gameCards = document.querySelectorAll(".game-card");
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (
    "IntersectionObserver" in window &&
    !reducedMotion
  ) {
    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove(
              "card-hidden"
            );
            entry.target.classList.add(
              "card-visible"
            );
            currentObserver.unobserve(
              entry.target
            );
          }
        });
      },
      {
        threshold: 0.1
      }
    );
    gameCards.forEach((card) => {
      card.classList.add("card-hidden");
      observer.observe(card);
    });
  }
  console.log(
    "ChefDesk Games Dashboard loaded successfully!"
  );
});