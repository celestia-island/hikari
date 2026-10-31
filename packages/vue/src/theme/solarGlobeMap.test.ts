// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
import { describe, expect, it } from "vitest";

import {
  SOLAR_GLOBE_MAP_HEIGHT,
  SOLAR_GLOBE_MAP_WIDTH,
  buildSolarGlobeMapSvg,
  projectToEquirectangular,
  solarGlobeMapDataUrl,
} from "./solarGlobeMap";

describe("projectToEquirectangular", () => {
  it("projects the geographic frame onto the raster", () => {
    expect(projectToEquirectangular(0, 0)).toEqual([512, 256]);
    expect(projectToEquirectangular(90, 180)).toEqual([1024, 0]);
    expect(projectToEquirectangular(-90, -180)).toEqual([0, 512]);
    expect(projectToEquirectangular(31.2, 121.5)[0]).toBeCloseTo(857.6, 0);
  });
});

describe("buildSolarGlobeMapSvg", () => {
  const svg = buildSolarGlobeMapSvg();

  it("emits a standalone SVG document at the equirectangular raster size", () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain(`viewBox="0 0 ${SOLAR_GLOBE_MAP_WIDTH} ${SOLAR_GLOBE_MAP_HEIGHT}"`);
  });

  it("is deterministic (the texture must not flap between builds)", () => {
    expect(buildSolarGlobeMapSvg()).toBe(svg);
  });

  it("parses cleanly and carries land, graticule and plate layers", () => {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    const root = doc.documentElement;
    expect(root.getAttribute("viewBox")).toBe(`0 0 ${SOLAR_GLOBE_MAP_WIDTH} ${SOLAR_GLOBE_MAP_HEIGHT}`);
    // Landmass polygons + graticule paths + the glow/line plate pair.
    const paths = doc.querySelectorAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(20);
  });

  it("draws NO text and NO flags — labels live in the tooltip, borders nowhere", () => {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("text")).toBeNull();
    expect(doc.querySelector("title")).toBeNull();
  });

  it("stays white-alpha only (the material tints it per theme)", () => {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const painted = [...doc.querySelectorAll("[fill], [stroke]")];
    expect(painted.length).toBeGreaterThan(0);
    for (const el of painted) {
      for (const attr of ["fill", "stroke"]) {
        const v = el.getAttribute(attr);
        if (!v || v === "none") continue;
        expect(v).toMatch(/^rgba\(255, ?255, ?255,/);
      }
    }
  });

  it("exposes a data URL for Image() rasterization", () => {
    expect(solarGlobeMapDataUrl().startsWith("data:image/svg+xml,")).toBe(true);
  });
});
