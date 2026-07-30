// Player selection persistence.
// sessionStorage is blocked by the preview iframe, so we use a cookie
// (document.cookie) which works in both preview and published contexts.
// Falls back to a module-level variable if cookies are unavailable.
let currentId: number | null = null;

function readCookie(): number | null {
  try {
    const m = document.cookie.match(/(?:^|;\s*)tw_player=(\d+)/);
    if (m) return Number(m[1]);
  } catch {
    // cookies blocked — fall through
  }
  return currentId;
}

function writeCookie(id: number | null) {
  currentId = id;
  try {
    if (id != null) {
      document.cookie = `tw_player=${id}; path=/; max-age=604800; SameSite=Lax`;
    } else {
      document.cookie = `tw_player=; path=/; max-age=0; SameSite=Lax`;
    }
  } catch {
    // cookies blocked — module-level fallback already set above
  }
}

export const playerStorage = {
  read(): number | null {
    return readCookie();
  },
  write(id: number | null) {
    writeCookie(id);
  },
};
