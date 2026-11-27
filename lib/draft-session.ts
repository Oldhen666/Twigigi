const STORAGE = "twigigi:draft-key";

let historyBack = false;
let visit = 0;
let mintedVisit = -1;
let mintedKey = "";

export function markHistoryBack() {
  historyBack = true;
}

export function notePath(pathname: string) {
  if (pathname !== "/dashboard/products/new") historyBack = false;
}

export function noteNewVisit() {
  if (historyBack) return;
  visit += 1;
  mintedVisit = -1;
}

export function nextDraftKey() {
  if (typeof window === "undefined") return "";
  if (historyBack) {
    const stored = sessionStorage.getItem(STORAGE);
    if (stored) {
      mintedVisit = visit;
      mintedKey = stored;
      return stored;
    }
  }
  if (mintedVisit === visit && mintedKey) return mintedKey;
  mintedKey = crypto.randomUUID();
  mintedVisit = visit;
  sessionStorage.setItem(STORAGE, mintedKey);
  return mintedKey;
}

export function rememberDraftKey(key: string) {
  if (!key || typeof window === "undefined") return;
  mintedKey = key;
  mintedVisit = visit;
  sessionStorage.setItem(STORAGE, key);
}
