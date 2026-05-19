// lib/shared/copy-text.ts
//
// Centralized clipboard helper. Uses navigator.clipboard.writeText when
// available; falls back to a hidden textarea + execCommand("copy") for
// older or restricted browsers. Returns a rejected promise on failure
// so callers can show "copy failed" feedback.

export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) resolve();
      else reject(new Error("execCommand copy failed"));
    } catch (err) {
      document.body.removeChild(ta);
      reject(err);
    }
  });
}
