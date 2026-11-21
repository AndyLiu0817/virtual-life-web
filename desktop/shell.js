const game = document.querySelector("iframe");

function fitGame() {
  const scale = Math.min(innerWidth / 1280, innerHeight / 800);
  game.style.setProperty("--game-scale", String(scale));
}

game.addEventListener("load", () => {
  game.contentDocument.documentElement.style.scrollbarWidth = "none";
});
window.addEventListener("resize", fitGame);
fitGame();
