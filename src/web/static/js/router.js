// 极简 hash 路由

export function navigate(hash) {
  if (location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    location.hash = hash;
  }
}

export function parseRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [name, ...rest] = raw.split("/");
  return { name: name || "cockpit", params: rest };
}
