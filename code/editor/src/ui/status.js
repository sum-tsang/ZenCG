// Status messaging helper.
// Build a status setter bound to the status element.
export function createStatusUpdater(dom) {
  // Update status text if the element exists.
  return function setStatus(message) {
    if (dom.status) {
      dom.status.textContent = message;
    }
  };
}
