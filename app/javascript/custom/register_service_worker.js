// app/javascript/custom/register_service_worker.js
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn("ServiceWorker 未対応");
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/service-worker.js');
    console.log('[PWA] ServiceWorker 登録成功:', reg);
    return reg;
  } catch (error) {
    console.error('[PWA] ServiceWorker 登録失敗:', error);
    throw error;
  }
}
