import { useEffect } from "react";

/**
 * Toggles `body.keyboard-open` class when the mobile virtual keyboard opens,
 * so the global fixed footer can be hidden and the body padding can be
 * removed (preventing the footer from covering form fields).
 *
 * Detection uses the VisualViewport API: if the visual viewport height
 * shrinks significantly versus the layout viewport, we assume the keyboard
 * is open.
 */
export function useKeyboardAware() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const THRESHOLD = 150; // px difference that indicates keyboard

    const update = () => {
      const diff = window.innerHeight - vv.height;
      const open = diff > THRESHOLD;
      const body = document.body;
      // Preview iframes can unmount while the document body is temporarily absent.
      if (!body) return;
      body.classList.toggle("keyboard-open", open);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      // Cleanup may run after the preview document has detached its body.
      document.body?.classList.remove("keyboard-open");
    };
  }, []);
}
