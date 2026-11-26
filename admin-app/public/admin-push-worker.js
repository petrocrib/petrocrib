self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  const orderId = event.data?.json().orderId;
  event.waitUntil(self.registration.showNotification(
    orderId ? "KA-CHING! 💸 New order received!" : "Ka-ching check! 🔔",
    {
      body: orderId ? "Someone just made your day. Time to get packing!" : "You're connected. Now we just need customers.",
      icon: "https://www.petrocrib.in/assets/img/logo.png",
      tag: orderId ? `paid-order-${orderId}` : "petrocrib-push-test",
    }
  ));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/admin/orders"));
});
