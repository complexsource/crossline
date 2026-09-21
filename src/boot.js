export async function finishBoot() {
  const style = document.getElementById("app-style");
  try {
    if (style.dataset.failed) throw Error("Styles could not load");
    if (!style.sheet)
      await new Promise((resolve, reject) => {
        style.addEventListener("load", resolve, { once: true });
        style.addEventListener(
          "error",
          () => reject(Error("Styles could not load")),
          { once: true },
        );
      });
    style.media = "all";
    // Discover the newly applied faces before waiting for the FontFaceSet.
    await new Promise(requestAnimationFrame);
    document.body.getBoundingClientRect();
    const hero = new Image();
    hero.src = "/previews/coastline-hero.webp";
    // Optional art/fonts cannot hold the page forever or cause a late font swap.
    await Promise.race([
      Promise.allSettled([hero.decode(), document.fonts.ready]),
      new Promise((r) => setTimeout(r, 3500)),
    ]);
    await new Promise(requestAnimationFrame);
    document.documentElement.classList.remove("booting");
    clearTimeout(window.crosslineBootTimer);
    const screen = document.getElementById("boot-screen");
    screen?.classList.add("leaving");
    setTimeout(() => screen?.remove(), 360);
  } catch {
    window.crosslineBootFail?.();
  }
}
