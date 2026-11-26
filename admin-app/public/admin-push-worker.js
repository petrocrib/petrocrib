self.addEventListener("push", event => {
  const orderId = event.data?.json().orderId;
  event.waitUntil(self.registration.showNotification(
    orderId ? "New paid Petrocrib order" : "Petrocrib notification test",
    {
      body: orderId ? "Open Petrocrib Admin to view your orders." : "Background order alerts are reaching this device.",
      tag: orderId ? `paid-order-${orderId}` : "petrocrib-push-test",
    }
  ));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/admin/orders"));
});
