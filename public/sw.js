/* Service worker Web Push — menampilkan notifikasi & membuka link saat diklik. */

self.addEventListener("push", (event) => {
  let data = { title: "MudahMengajar", body: "", url: "/dashboard", tag: "mudahmengajar" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* payload bukan JSON — pakai default */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || undefined,
      tag: data.tag,
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
