// app/javascript/custom/hp_date_init.js
document.addEventListener("turbo:load", () => {
  const today = new Date().toISOString().slice(0, 10);
  const savedDate = localStorage.getItem("hpDate");

  if (savedDate !== today) {
    localStorage.setItem("hpPercentage", "50");
    localStorage.setItem("hpDate", today);
  }
});
