import { BUY_CATEGORIES, BUY_ITEMS, itemStats } from "../shared/buy.js";
import { WEAPONS, GRENADES } from "../shared/weapons.js";
import { openDialog } from "./dialog.js";

// This UI renders small static thumbnails, not another WebGL canvas. Catalog
// values are owned by this module; player names are never injected as markup.
export function createBuyMenu({ getState, select, close, key }) {
  let modal = null,
    dialog = null,
    category = "RIFLE",
    busy = false;
  const setText = (selector, value) => {
    const el = modal?.querySelector(selector);
    if (el && el.textContent !== value) el.textContent = value;
  };
  function cards() {
    const group = BUY_CATEGORIES.find((c) => c.id === category);
    setText("#buy-category-title", group.name);
    setText("#buy-description", group.description);
    modal.querySelectorAll("[data-buy-tab]").forEach((el) => {
      const active = el.dataset.buyTab === category;
      el.setAttribute("aria-selected", String(active));
      el.tabIndex = active ? 0 : -1;
    });
    const panel = modal.querySelector("#buy-items");
    panel.setAttribute("aria-labelledby", `buy-tab-${category}`);
    panel.innerHTML = BUY_ITEMS.filter((i) => i.category === category)
      .map(
        (item) => `
      <article class="buy-card" data-item="${item.id}">
        <div class="buy-card-image"><img src="${item.image}" alt="${item.name}" width="640" height="360" loading="lazy" decoding="async"><span class="buy-item-state"></span></div>
        <div class="buy-card-body"><div class="buy-item-heading"><h3>${item.name}</h3><span>${item.available ? "FREE" : "MODE LOCKED"}</span></div>
        <dl class="buy-stats">${itemStats(item.id)
          .map(
            ([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`,
          )
          .join("")}</dl>
        <button data-buy="${item.id}" aria-label="Select ${item.name}">SELECT <span>＋</span></button></div>
      </article>`,
      )
      .join("");
    panel
      .querySelectorAll("[data-buy]")
      .forEach(
        (button) => (button.onclick = () => purchase(button.dataset.buy)),
      );
    update();
  }
  async function purchase(id) {
    if (busy || !modal) return;
    const original = modal;
    busy = true;
    setText("#buy-status", "Preparing equipment…");
    update();
    try {
      const result = await select(id, () => modal === original);
      if (modal !== original) return;
      setText(
        "#buy-status",
        result
          ? id === "previous"
            ? "Previous loadout equipped."
            : `${WEAPONS[id].name} selected.`
          : "Selection was not completed. Please try again while buy time remains.",
      );
    } catch (error) {
      if (modal === original)
        setText(
          "#buy-status",
          `Could not prepare equipment: ${error.message}. Try again.`,
        );
    } finally {
      if (modal === original) {
        busy = false;
        update();
      }
    }
  }
  function update() {
    if (!modal) return;
    const { player, opening } = getState();
    if (!player || player.hp <= 0 || player.buyRemaining <= 0) {
      close(false);
      return;
    }
    setText(
      "#buy-seconds",
      `${Math.ceil(player.buyRemaining).toString().padStart(2, "0")}s`,
    );
    modal.classList.toggle("buy-urgent", player.buyRemaining <= 5);
    setText("#buy-phase", opening ? "OPENING BUY PHASE" : "RESPAWN BUY WINDOW");
    setText(
      "#buy-safety",
      opening
        ? "Deployment is protected. Movement and combat start together after buy time."
        : "MATCH IS LIVE. The Buy Menu does not pause combat or extend spawn protection.",
    );
    for (const card of modal.querySelectorAll("[data-item]")) {
      const id = card.dataset.item,
        button = card.querySelector("button"),
        w = WEAPONS[id];
      const owned = GRENADES.includes(id)
        ? player.grenades[id] > 0
        : Object.values(player.slots).includes(id);
      const equipped = player.weapon === id,
        spent = GRENADES.includes(id) && !owned;
      const label =
        id === "bomb"
          ? "NOT IN TEAM DEATHMATCH"
          : spent
            ? "SPENT THIS LIFE"
            : equipped
              ? "EQUIPPED ✓"
              : "SELECT ＋";
      if (button.textContent !== label) button.textContent = label;
      button.disabled = busy || equipped || spent || id === "bomb";
      card.classList.toggle("is-owned", owned);
      card.classList.toggle("is-locked", spent || id === "bomb");
      const badge = card.querySelector(".buy-item-state"),
        text = owned
          ? "IN LOADOUT"
          : id === "bomb"
            ? "FUTURE MODE"
            : w.slot.toUpperCase();
      if (badge.textContent !== text) badge.textContent = text;
    }
    for (const slot of ["primary", "secondary"]) {
      const id = player.slots[slot],
        el = modal.querySelector(`[data-buy-slot="${slot}"]`);
      if (el.dataset.weapon !== (id || "")) {
        el.dataset.weapon = id || "";
        el.innerHTML = `<small>${slot === "primary" ? "PRIMARY" : "SIDEARM"}</small>${id ? `<img src="/previews/weapons/${id}.webp" alt="" width="640" height="360"><b>${WEAPONS[id].name}</b>` : "<b>Empty slot</b>"}`;
      }
    }
    const previous = modal.querySelector("#buy-previous");
    previous.disabled = busy || !player.previousLoadout;
    setText(
      "#buy-previous-detail",
      player.previousLoadout
        ? `${WEAPONS[player.previousLoadout.primary]?.name} + ${WEAPONS[player.previousLoadout.secondary]?.name}`
        : "Available after your first life",
    );
    setText(
      "#buy-grenades",
      GRENADES.map(
        (id) => `${id.toUpperCase()} ${player.grenades[id] || 0}/1`,
      ).join(" · "),
    );
  }
  return {
    get isOpen() {
      return !!modal;
    },
    open() {
      if (modal) return;
      modal = document.createElement("dialog");
      modal.id = "buy-menu";
      modal.className = "modal buy-modal";
      modal.innerHTML = `<section class="buy-shell"><header class="buy-header"><div><div class="eyebrow">CROSSLINE / FIELD ARMORY</div><h2 id="buy-title">GEAR UP.</h2></div><div class="buy-countdown"><small id="buy-phase"></small><strong id="buy-seconds"></strong></div><button id="buy-close" class="subtle" aria-label="Close Buy Menu">CLOSE ×</button></header>
        <nav class="buy-tabs" role="tablist" aria-label="Equipment categories">${BUY_CATEGORIES.map((c) => `<button role="tab" id="buy-tab-${c.id}" data-buy-tab="${c.id}" aria-controls="buy-items">${c.name}<small>${BUY_ITEMS.filter((i) => i.category === c.id).length}</small></button>`).join("")}</nav>
        <div class="buy-layout"><main class="buy-catalog"><div class="buy-category-heading"><h3 id="buy-category-title"></h3><p id="buy-description"></p></div><div id="buy-items" class="buy-grid" role="tabpanel" tabindex="0"></div></main>
        <aside class="buy-loadout"><div class="eyebrow">YOUR LOADOUT</div><div data-buy-slot="primary"></div><div data-buy-slot="secondary"></div><p id="buy-grenades"></p><p class="muted">Field Knife included</p><button id="buy-previous">USE PREVIOUS LOADOUT</button><small id="buy-previous-detail"></small><p id="buy-safety"></p></aside></div>
        <footer class="buy-footer"><div><p id="buy-status" role="status" aria-live="polite">Free selection · One primary + one sidearm · No ammo refills on reselection</p><small>Accuracy is a relative hip-fire rating. ${key()} / ESC closes this menu.</small></div><button id="buy-resume" class="primary">DONE · RESUME ↗</button></footer></section>`;
      document.body.append(modal);
      busy = false;
      modal.querySelector("#buy-close").onclick = () => close(false);
      modal.querySelector("#buy-resume").onclick = () => close(true);
      modal.querySelector("#buy-previous").onclick = () => purchase("previous");
      modal
        .querySelectorAll("[data-buy-tab]")
        .forEach((button, index, buttons) => {
          const activate = () => {
            category = button.dataset.buyTab;
            cards();
          };
          button.onclick = activate;
          button.onkeydown = (e) => {
            let next;
            if (e.key === "ArrowRight") next = (index + 1) % buttons.length;
            if (e.key === "ArrowLeft")
              next = (index + buttons.length - 1) % buttons.length;
            if (e.key === "Home") next = 0;
            if (e.key === "End") next = buttons.length - 1;
            if (next !== undefined) {
              e.preventDefault();
              buttons[next].click();
              buttons[next].focus();
            }
          };
        });
      dialog = openDialog(modal, {
        labelledBy: "buy-title",
        initialFocus: `#buy-tab-${category}`,
        onDismiss: () => close(false),
      });
      cards();
    },
    update,
    close() {
      dialog?.close(false);
      dialog = null;
      modal = null;
      busy = false;
    },
  };
}
