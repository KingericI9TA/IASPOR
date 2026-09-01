import { registerPedidoSw } from "@/lib/pedido-remind";
import { downloadTallerZip } from "@/lib/backup";
import { writeFolderEstado } from "@/lib/taller-folder";
import { publicUrl } from "@/lib/utils";

const DONE_KEY = "iaspor:daily-backup-day";
const HOUR = 23;

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function lastDailyBackupDay() {
  return localStorage.getItem(DONE_KEY);
}

export function nextBackupAt(now = new Date()) {
  const t = new Date(now);
  t.setHours(HOUR, 0, 0, 0);
  if (now.getTime() >= t.getTime()) t.setDate(t.getDate() + 1);
  return t;
}

function inBackupWindow(now = new Date()) {
  return now.getHours() === HOUR;
}

async function showBackupNotify() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const title = "IASPOR · copia diaria";
  const options: NotificationOptions = {
    body: "Las 23:00. Toca para guardar la copia ZIP de hoy.",
    tag: "iaspor-copia-diaria",
    icon: publicUrl("favicon.svg"),
    data: { url: publicUrl("?tab=archivos&copia=1") },
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

async function scheduleNativeTrigger(when: Date) {
  const Trigger = (window as { TimestampTrigger?: new (ts: number) => unknown }).TimestampTrigger;
  if (!Trigger || when.getTime() <= Date.now()) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = await registerPedidoSw();
    if (!reg) return;
    await reg.showNotification("IASPOR · copia diaria", {
      body: "Las 23:00. Toca para guardar la copia ZIP de hoy.",
      tag: "iaspor-copia-diaria",
      icon: publicUrl("favicon.svg"),
      data: { url: publicUrl("?tab=archivos&copia=1") },
      showTrigger: new Trigger(when.getTime()),
    } as NotificationOptions);
  } catch {
    /* API not available */
  }
}

export async function runDailyBackupNow() {
  await writeFolderEstado();
  const name = await downloadTallerZip();
  localStorage.setItem(DONE_KEY, dayKey());
  return name;
}

export async function fireDailyBackupIfDue(now = new Date()) {
  if (!inBackupWindow(now)) return false;
  if (localStorage.getItem(DONE_KEY) === dayKey(now)) return false;
  await showBackupNotify();
  try {
    await runDailyBackupNow();
    return true;
  } catch {
    return false;
  }
}

let timer: number | null = null;

export function armDailyBackup() {
  void (async () => {
    await registerPedidoSw();
    await fireDailyBackupIfDue();
  })();
  if (timer) window.clearTimeout(timer);
  const when = nextBackupAt();
  const wait = when.getTime() - Date.now();
  if (wait > 0 && wait < 26 * 60 * 60 * 1000) {
    timer = window.setTimeout(() => {
      void fireDailyBackupIfDue();
    }, wait);
  }
  void scheduleNativeTrigger(when);
}
