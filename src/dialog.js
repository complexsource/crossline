// Native dialogs keep keyboard focus and pointer interaction out of the page
// behind them, including when a settings category rebuilds its contents.
export function openDialog(
  modal,
  { labelledBy, initialFocus, returnFocus = document.activeElement, onDismiss },
) {
  modal.setAttribute("aria-labelledby", labelledBy);
  modal.setAttribute("aria-modal", "true");
  modal.addEventListener("cancel", (event) => {
    event.preventDefault();
    onDismiss();
  });
  modal.showModal();
  modal.querySelector(initialFocus)?.focus({ preventScroll: true });
  return {
    returnFocus,
    close(restoreFocus = true) {
      if (modal.open) modal.close();
      modal.remove();
      if (restoreFocus && returnFocus?.isConnected)
        returnFocus.focus({ preventScroll: true });
    },
  };
}
