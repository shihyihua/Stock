self.addEventListener("push", function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "🎈 股票帶你飛", body: event.data ? event.data.text() : "" };
  }
  var title = data.title || "🎈 股票帶你飛";
  var options = {
    body: data.body || "",
    tag: "stock-alert",
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if ("focus" in clientList[i]) return clientList[i].focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
