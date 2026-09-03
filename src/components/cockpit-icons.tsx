import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "cyan" | "amber" | "green" | "red" | "orange" | "yellow" | "white";

type IconProps = { className?: string; tone?: Tone };

function Plate({ className, tone = "cyan", children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn("cockpit-icon cockpit-solid", `lamp-${tone}`, className)}
      aria-hidden
    >
      <rect x="1" y="1" width="22" height="22" rx="3.2" fill="currentColor" opacity="0.22" />
      <rect x="1" y="1" width="22" height="22" rx="3.2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="1.8" fill="currentColor" opacity="0.14" stroke="currentColor" strokeWidth="1.4" />
      <circle className="lamp" cx="18.7" cy="5.3" r="1.55" />
      {children}
    </svg>
  );
}

export function IconBuscar({ className }: IconProps) {
  return (
    <Plate className={className} tone="cyan">
      <circle cx="11" cy="12" r="4.4" fill="currentColor" opacity="0.35" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="11" cy="12" r="1.5" fill="currentColor" />
      <path d="M14.3 15.4 17.8 18.9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="square" />
    </Plate>
  );
}

export function IconArchivos({ className }: IconProps) {
  return (
    <Plate className={className} tone="amber">
      <rect x="6" y="7" width="12.2" height="3.3" rx="0.6" fill="currentColor" />
      <rect x="6" y="11.15" width="12.2" height="3.3" rx="0.6" fill="currentColor" opacity="0.78" />
      <rect x="6" y="15.3" width="8.6" height="3.3" rx="0.6" fill="currentColor" opacity="0.55" />
    </Plate>
  );
}

export function IconMarcas({ className }: IconProps) {
  return (
    <Plate className={className} tone="green">
      <path d="M12 6.8 17.4 12 12 17.2 6.6 12Z" fill="currentColor" />
      <circle cx="12" cy="12" r="1.35" fill="#041018" />
    </Plate>
  );
}

export function IconCatalogo({ className }: IconProps) {
  return (
    <Plate className={className} tone="white">
      {[0, 1, 2].flatMap((row) =>
        [0, 1].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={6.1 + col * 5.9}
            y={6.8 + row * 4.15}
            width="4.8"
            height="3.1"
            rx="0.45"
            fill="currentColor"
            opacity={col === 1 && row === 1 ? 1 : 0.7}
          />
        )),
      )}
    </Plate>
  );
}

export function IconPiezas({ className }: IconProps) {
  return (
    <Plate className={className} tone="orange">
      <rect x="5.8" y="8" width="5.2" height="9" rx="0.55" fill="currentColor" />
      <rect x="13" y="6.6" width="5.2" height="4.8" rx="0.55" fill="currentColor" />
      <rect x="13" y="12.4" width="5.2" height="4.6" rx="0.55" fill="currentColor" opacity="0.7" />
    </Plate>
  );
}

export function IconCodigos({ className }: IconProps) {
  return (
    <Plate className={className} tone="yellow">
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => (
          <circle
            key={`${r}-${c}`}
            cx={8 + c * 4}
            cy={8.8 + r * 4}
            r="1.35"
            fill="currentColor"
            opacity={r === 1 && c === 1 ? 1 : 0.72}
          />
        )),
      )}
    </Plate>
  );
}

export function IconJarvis({ className }: IconProps) {
  return (
    <Plate className={className} tone="amber">
      <path
        d="M12 5.55c3.2 0 5.6 1.5 5.75 4.45.1 1.2.12 2.35.06 3.35 0 2.4-1.2 4.25-3 5.25L12 19.35l-2.81-.75c-1.8-1-3-2.85-3-5.25-.06-1 .0-2.15.06-3.35C6.4 7.05 8.8 5.55 12 5.55Z"
        fill="#c4102e"
      />
      <path
        d="M7.85 8.55c.9-1.45 2.25-2.1 4.15-2.1s3.25.65 4.15 2.1c.4.7.6 1.55.7 2.4H7.15c.1-.85.3-1.7.7-2.4Z"
        fill="#f5c518"
      />
      <path
        d="M7.2 11.3c.2 2.45 1.95 4.35 4.8 5.05.5.12 1 .18 1.4.18s.9-.06 1.4-.18c2.85-.7 4.6-2.6 4.8-5.05H7.2Z"
        fill="#f5c518"
      />
      <path d="M5.95 10.55c-.1.9 0 1.75.35 2.45l1.5.7-.45-3.05Z" fill="#f5c518" />
      <path d="M18.05 10.55c.1.9 0 1.75-.35 2.45l-1.5.7.45-3.05Z" fill="#f5c518" />
      <rect x="7.45" y="10.4" width="9.1" height="2.35" fill="#1a0808" />
      <rect x="7.9" y="10.7" width="3.35" height="1.55" rx="0.15" fill="#f4feff" />
      <rect x="12.75" y="10.7" width="3.35" height="1.55" rx="0.15" fill="#f4feff" />
      <path d="M12 6.7 13.15 8.85h-2.3Z" fill="#c4102e" />
      <rect x="10.2" y="15.85" width="3.6" height="0.75" rx="0.12" fill="#1a0808" />
    </Plate>
  );
}

export function IconAverias({ className }: IconProps) {
  return (
    <Plate className={className} tone="orange">
      <path d="M12 6.2 18.4 17.6H5.6Z" fill="currentColor" />
      <rect x="11.2" y="10" width="1.6" height="4.3" fill="#041018" />
      <rect x="11.2" y="15.1" width="1.6" height="1.35" fill="#041018" />
    </Plate>
  );
}

export function IconAlbaran({ className }: IconProps) {
  return (
    <Plate className={className} tone="red">
      <rect x="6.6" y="6.4" width="10.8" height="12.2" rx="0.7" fill="currentColor" />
      <path d="M8.6 9.4h6.8M8.6 12h6.8M8.6 14.6h4.2" stroke="#041018" strokeWidth="1.5" strokeLinecap="square" />
    </Plate>
  );
}

export function IconPresupuesto({ className }: IconProps) {
  return (
    <Plate className={className} tone="green">
      <rect x="7.2" y="10" width="2.8" height="7" rx="0.4" fill="currentColor" opacity="0.75" />
      <rect x="11.6" y="7.4" width="2.8" height="9.6" rx="0.4" fill="currentColor" />
      <rect x="16" y="12.2" width="2.4" height="4.8" rx="0.4" fill="currentColor" opacity="0.55" />
    </Plate>
  );
}

export function IconPedido({ className }: IconProps) {
  return (
    <Plate className={className} tone="white">
      <rect x="6.4" y="6.2" width="11.2" height="12.4" rx="0.7" fill="currentColor" />
      <path d="M8.6 9.4h6.8M8.6 12.1h6.8M8.6 14.8h4.4" stroke="#041018" strokeWidth="1.55" strokeLinecap="square" />
      <circle cx="16.6" cy="16.6" r="3.05" fill="currentColor" />
      <path d="M16.6 15.1v3M15.1 16.6h3" stroke="#041018" strokeWidth="1.4" strokeLinecap="square" />
    </Plate>
  );
}

export function IconWeb({ className }: IconProps) {
  return (
    <Plate className={className} tone="cyan">
      <circle cx="12" cy="12.1" r="5.4" fill="currentColor" />
      <path d="M6.6 12.1h10.8M12 6.7c1.7 1.8 2.6 3.5 2.6 5.4s-.9 3.6-2.6 5.4c-1.7-1.8-2.6-3.5-2.6-5.4s.9-3.6 2.6-5.4Z" stroke="#041018" strokeWidth="1.35" />
    </Plate>
  );
}

export function IconLocal({ className }: IconProps) {
  return (
    <Plate className={className} tone="amber">
      <circle cx="12" cy="10.1" r="2.6" fill="currentColor" />
      <path d="M12 12.4 7.8 18.6h8.4Z" fill="currentColor" />
    </Plate>
  );
}

export function IconCamara({ className }: IconProps) {
  return (
    <Plate className={className} tone="cyan">
      <rect x="5.6" y="8.2" width="12.8" height="9.2" rx="1.2" fill="currentColor" />
      <rect x="8.2" y="6.4" width="4.2" height="2.2" rx="0.4" fill="currentColor" />
      <circle cx="12" cy="12.7" r="3.05" fill="#041018" />
      <circle cx="12" cy="12.7" r="1.45" fill="currentColor" />
    </Plate>
  );
}

export function IconGaleria({ className }: IconProps) {
  return (
    <Plate className={className} tone="amber">
      <rect x="5.6" y="7.2" width="12.8" height="10.4" rx="1.1" fill="currentColor" opacity="0.35" />
      <rect x="5.6" y="7.2" width="12.8" height="10.4" rx="1.1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.8 15.6 10.2 12l2.4 2.3 1.6-1.5 2.8 2.8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="bevel" />
      <circle cx="9.1" cy="10.1" r="1.15" fill="currentColor" />
    </Plate>
  );
}

export function IconOficina({ className }: IconProps) {
  return (
    <Plate className={className} tone="yellow">
      <rect x="6" y="6.4" width="5" height="5" rx="0.55" fill="currentColor" />
      <rect x="13" y="6.4" width="5" height="5" rx="0.55" fill="currentColor" opacity="0.78" />
      <rect x="6" y="13.2" width="5" height="5" rx="0.55" fill="currentColor" opacity="0.62" />
      <rect x="13" y="13.2" width="5" height="5" rx="0.55" fill="currentColor" opacity="0.9" />
    </Plate>
  );
}

export const COCKPIT = {
  buscar: IconBuscar,
  archivos: IconArchivos,
  marcas: IconMarcas,
  catalogo: IconCatalogo,
  piezas: IconPiezas,
  codigos: IconCodigos,
  albaran: IconAlbaran,
  pedido: IconPedido,
  presupuesto: IconPresupuesto,
  averias: IconAverias,
  web: IconWeb,
  local: IconLocal,
  camara: IconCamara,
  galeria: IconGaleria,
  oficina: IconOficina,
};
