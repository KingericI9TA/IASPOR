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
    <Plate className={className} tone="red">
      <path
        d="M12 5.85c2.95 0 5.2 1.2 5.45 3.95l.28 2.85-.78 2.35c-.4.95-1.25 1.85-2.35 2.4L12 18.85l-2.6-1.45c-1.1-.55-1.95-1.45-2.35-2.4l-.78-2.35.28-2.85C6.8 7.05 9.05 5.85 12 5.85Z"
        fill="currentColor"
      />
      <path
        d="M8.2 9.2c.6-1.55 1.9-2.4 3.8-2.4s3.2.85 3.8 2.4c.18.5.28 1.15.32 1.75H7.88c.04-.6.14-1.25.32-1.75Z"
        fill="#ffcc4a"
      />
      <path
        d="M8.05 11.55 7.15 13.5c.5 1.2 1.5 2.05 2.65 2.55.7.3 1.45.5 2.2.5s1.5-.2 2.2-.5c1.15-.5 2.15-1.35 2.65-2.55l-.9-1.95H8.05Z"
        fill="#ffcc4a"
      />
      <path d="M6.4 11 8.15 10.3 7.45 13.2 6.15 12.35Z" fill="#ffcc4a" />
      <path d="M17.6 11 15.85 10.3 16.55 13.2 17.85 12.35Z" fill="#ffcc4a" />
      <rect x="7.55" y="10.45" width="8.9" height="2.45" rx="0.45" fill="#041018" />
      <rect x="8.2" y="10.95" width="7.6" height="1.35" rx="0.35" fill="#7ee7ff" />
      <path d="M12 6.95 12.9 8.65h-1.8Z" fill="#041018" />
      <path d="M10.15 16.35h3.7" stroke="#041018" strokeWidth="1.2" strokeLinecap="square" />
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
  web: IconWeb,
  local: IconLocal,
  camara: IconCamara,
  galeria: IconGaleria,
  oficina: IconOficina,
};
