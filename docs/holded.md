# Holded — cuando esté en la oficina

Pedido de Jan (sep 2026): no implementar aún. Retomar cuando Holded esté en marcha.

IASPOR sigue siendo la app de obra (avería → albarán, sin cobertura). Holded es la oficina (facturación legal, Verifactu, clientes).

## Orden de trabajo

1. **Día 1 — “Para Holded” en el albarán (sin API)**  
   Excel/XLSX en el formato de importación de Holded (Inventario → Albaranes):  
   contacto, NIF, dirección, población, líneas, IVA, forma de pago.  
   Oficina importa el archivo. Funciona offline. Sin claves en el teléfono.  
   Guía: https://help.holded.com/es/articles/6967257-importar-o-exportar-un-albaran

2. **Misma ficha de cliente**  
   Usar NIF y teléfono de avería/albarán para no duplicar contactos en Holded.

3. **Cuando Holded esté rodando — API**  
   Avería cerrada → albarán IASPOR → `POST /api/v2/waybills`.  
   La factura la saca oficina en Holded (convertir albarán → factura).  
   API key **nunca** en el APK: hace falta un puente (función servidor o script de oficina).  
   Docs: https://www.holded.com/es/desarrolladores  
   Albaranes: https://www.holded.com/es/desarrolladores/referencia-api/albaranes  
   Facturas: `POST /api/v2/invoices` (contact_id obligatorio).  
   Contactos: `GET /api/v2/contacts?phone=&vat_number=`

4. **Precios**  
   Catálogo Holded (mano de obra, desplazamiento, recambio genérico) para que el albarán de obra use los mismos importes que oficina.

5. **Presupuesto (menos urgente)**  
   PDF IASPOR → presupuesto/estimate Holded.

## Qué no hacer

- Facturar en firme desde el móvil.
- Meter la API key en el TWA / GitHub Pages.
- Quitar el albarán de obra: en campo se firma y se trabaja sin red.

## Encaje con lo que ya hay

- Avería estado `albaran` + `albaranNumero` (`src/lib/averias.ts`, `averias-pane.tsx`).
- Numeración y PDF de albarán: `src/lib/albaran.ts`, carpeta `albaranes/` en el teléfono.
- Presupuesto PDF: `src/lib/presupuesto.ts`.
