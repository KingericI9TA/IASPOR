import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultErrorComponent: AppErrorComponent,
    defaultNotFoundComponent: () => (
      <main className="grid min-h-dvh place-items-center p-6 text-center">
        <p className="text-sm">Esa pantalla no existe. Vuelve al inicio.</p>
      </main>
    ),
  });
}
