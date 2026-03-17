# WaterReminder (PWA)

App web para registrar hidratación y recibir recordatorios.

## Notificaciones push en móvil con OneSignal

La app ya está integrada con **react-onesignal**. No necesitas pegar manualmente el `<script>` de OneSignal en `index.html`.

### 1) Código obtenido en OneSignal
Si OneSignal te dio algo así:

```html
<script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
<script>
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
      appId: "1834a348-0952-4206-9d1b-69135970fe75",
      safari_web_id: "web.onesignal.auto.1997779e-e1de-41f4-ac74-4543cfbf0412",
      notifyButton: { enable: true }
    });
  });
</script>
```

en este proyecto debes pasar esos valores por variables de entorno.

### 2) Configurar variables de entorno
Crea `.env` en la raíz de `water-pwa`:

```bash
VITE_ONESIGNAL_APP_ID=1834a348-0952-4206-9d1b-69135970fe75
VITE_ONESIGNAL_SAFARI_WEB_ID=web.onesignal.auto.1997779e-e1de-41f4-ac74-4543cfbf0412
```

### 3) Service worker
El worker de OneSignal ya está incluido en:

- `public/onesignal/OneSignalSDKWorker.js`

### 4) Uso en la app
1. Abre **Ajustes**.
2. En “Notificaciones al móvil”, pulsa **Activar avisos**.
3. Acepta el permiso del navegador.

> Importante: en producción necesitas HTTPS para recibir push.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

### 4) Uso en la app
1. Abre **Ajustes**.
2. En “Notificaciones al móvil”, pulsa **Activar avisos**.
3. Acepta el permiso del navegador.

> Importante: en producción necesitas HTTPS para recibir push.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## Troubleshooting rápido (si no aparecen suscriptores)

- Verifica en el navegador que `https://tu-dominio/onesignal/OneSignalSDKWorker.js` responda `200` y no esté vacío.
- Comprueba que el dominio en OneSignal coincide exactamente con el de Vercel (incluyendo `www` o sin `www`).
- Tras cambiar variables en Vercel, haz un redeploy para que Vite regenere el build.
- Después de aceptar permiso, pulsa **Activar avisos** en Ajustes para hacer `optIn` explícito.
