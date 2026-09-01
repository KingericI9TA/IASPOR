import { loadPedido } from "@/lib/faac-pedido";
import { publicUrl } from "@/lib/utils";

const SENT_KEY = "iaspor:pedido-reminded-ym";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function lastDayOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function isEndOfMonth(d = new Date()) {
  return d.getDate() >= lastDayOfMonth(d) - 1;
}

function minutesNow(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

export function inNotifyHours(d = new Date()) {
  const m = minutesNow(d);
  return m >= 9 * 60 && m < 19 * 60;
}

function afterNineThirty(d = new Date()) {
  return minutesNow(d) >= 9 * 60 + 30;
}

export function pendingPieceCount() {
  return loadPedido().reduce((n, i) => n + i.qty, 0);
}

export function nextReminderAt(now = new Date()) {
  const todayNineThirty = new Date(now);
  todayNineThirty.setHours(9, 30, 0, 0);
  if (isEndOfMonth(now) && now < todayNineThirty) return todayNineThirty;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0, 9, 30, 0, 0);
  if (now < last) return last;
  return new Date(now.getFullYear(), now.getMonth() + 2, 0, 9, 30, 0, 0);
}

export async function registerPedidoSw() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(`${publicUrl("sw.js")}?v=iaspor-jarvis-20260901`);
  } catch {
    return null;
  }
}

export async function askPedidoNotify(): Promise<NotificationPermission | "unsupported"> {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

async function showPush(count: number) {
  const title = "IASPOR · piezas pendientes";
  const body =
    count === 1
      ? "Fin de mes: tienes 1 pieza pendiente de pedir."
      : `Fin de mes: tienes ${count} piezas pendientes de pedir.`;
  const options: NotificationOptions = {
    body,
    tag: "iaspor-pedido-fin-mes",
    icon: publicUrl("favicon.svg"),
    data: { url: publicUrl("?tab=pedido") },
    silent: false,
  };
  try {
    const reg = await registerPedidoSw();
    if (reg) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    /* fall through */
  }
  new Notification(title, options);
}

export async function firePedidoReminderIfDue(now = new Date()) {
  const count = pendingPieceCount();
  if (count < 1) return false;
  if (!isEndOfMonth(now) || !inNotifyHours(now) || !afterNineThirty(now)) return false;
  if (localStorage.getItem(SENT_KEY) === monthKey(now)) return false;
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  await showPush(count);
  localStorage.setItem(SENT_KEY, monthKey(now));
  return true;
}

async function scheduleNativeTrigger(when: Date, count: number) {
  const Trigger = (window as { TimestampTrigger?: new (ts: number) => unknown }).TimestampTrigger;
  if (!Trigger || when.getTime() <= Date.now()) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = await registerPedidoSw();
    if (!reg) return;
    await reg.showNotification("IASPOR · piezas pendientes", {
      body:
        count === 1
          ? "Fin de mes: tienes 1 pieza pendiente de pedir."
          : `Fin de mes: tienes ${count} piezas pendientes de pedir.`,
      tag: "iaspor-pedido-fin-mes",
      icon: publicUrl("favicon.svg"),
      data: { url: publicUrl("?tab=pedido") },
      showTrigger: new Trigger(when.getTime()),
    } as NotificationOptions);
  } catch {
    /* API not available */
  }
}

let timer: number | null = null;

export function armPedidoReminder() {
  void (async () => {
    await registerPedidoSw();
    await firePedidoReminderIfDue();
  })();
  if (timer) window.clearTimeout(timer);
  const count = pendingPieceCount();
  if (count < 1) return;
  const when = nextReminderAt();
  const wait = when.getTime() - Date.now();
  if (wait > 0 && wait < 8 * 24 * 60 * 60 * 1000) {
    timer = window.setTimeout(() => {
      void firePedidoReminderIfDue();
    }, wait);
  }
  void scheduleNativeTrigger(when, count);
}
