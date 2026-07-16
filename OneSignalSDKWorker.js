/**
 * OneSignalSDKWorker.js — Alcartel
 *
 * Service worker único registado no scope raiz ('/'). Combina:
 *  1) a lógica de cache/offline do PWA já existente em /sw.js
 *  2) o SDK de push da OneSignal (v16)
 *
 * Só pode existir UM service worker activo por scope. Ter /sw.js e
 * /OneSignalSDKWorker.js registados separadamente no mesmo scope
 * causaria conflitos (o browser só mantém um como controlador activo).
 * Por isso o /sw.js deixou de ser registado directamente no index.html
 * — este ficheiro importa-o, e é ele que fica registado (automaticamente,
 * pelo OneSignal SDK a partir do OneSignal.init() em index.html).
 */
importScripts("/sw.js");
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
