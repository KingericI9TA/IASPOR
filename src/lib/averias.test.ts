import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractIasporLine, mapsQuery, parseIasporAviso } from "./averias.ts";

describe("parseIasporAviso", () => {
  it("parte el formato de cinco campos", () => {
    const d = parseIasporAviso(
      "IASPOR: Comunidad | juan alvargonzalez 3 | Gijón | 64539727 | Portón no abre",
    );
    assert.ok(d);
    assert.equal(d.cliente, "Comunidad");
    assert.equal(d.direccion, "juan alvargonzalez 3");
    assert.equal(d.poblacion, "Gijón");
    assert.equal(d.telefono, "64539727");
    assert.equal(d.averia, "Portón no abre");
  });

  it("acepta IASPOR con espacio y minúsculas", () => {
    const d = parseIasporAviso("iaspor : Pepe | Calle Avelino 3 | Gijon | 985123456 | Puerta no cierra");
    assert.equal(d?.cliente, "Pepe");
    assert.equal(d?.averia, "Puerta no cierra");
  });

  it("saca la línea IASPOR de un pegado con más texto", () => {
    const line = extractIasporLine("ok voy\nIASPOR: Ana | Ribagorza 5 | Gijón | 611000000 | No abre\n+34 611");
    assert.equal(line, "IASPOR: Ana | Ribagorza 5 | Gijón | 611000000 | No abre");
  });

  it("arma la búsqueda de Maps con calle y pueblo", () => {
    assert.equal(mapsQuery({ direccion: "juan alvargonzalez 3", poblacion: "Gijón" }), "juan alvargonzalez 3, Gijón");
  });
});
