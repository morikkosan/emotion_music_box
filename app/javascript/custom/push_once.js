// app/javascript/custom/push_once.js
import { subscribeToPushNotifications } from "./push_subscription";

let __pushSubRequested = false;

function requestPushOnce() {
  if (!window.isLoggedIn) return;
  if (__pushSubRequested) return;
  __pushSubRequested = true;
  subscribeToPushNotifications().catch(err => {
    console.error("Push通知登録エラー:", err);
  });
}

document.addEventListener("DOMContentLoaded", requestPushOnce);
document.addEventListener("turbo:load",      requestPushOnce);
