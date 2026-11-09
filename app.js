document.addEventListener("DOMContentLoaded", () => {
  const notice = document.querySelector(".notice");
  if (notice) {
    notice.setAttribute("role", "status");
    notice.textContent = "Die frühere Demo-Oberfläche ist während der Datenmigration deaktiviert. Kanonische Modelldaten liegen in data/models/ und sind nicht als belegte Handschriftstandards zu verstehen.";
  }

  document.querySelectorAll(".tabs button, .panel select, .panel input, .panel button").forEach((control) => {
    control.disabled = true;
  });
});
