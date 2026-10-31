// AI-generated: developed with the ZCode agent (model GLM-5.3); human-directed.
/**
 * solarGlobeMap — the timezone globe's embedded base map, generated from
 * in-file geometry (2026-10-31 product direction).
 *
 * Deliberately a BORDERLESS world: the map carries continent silhouettes
 * and TECTONIC PLATE boundary lines only — never national borders, never
 * country labels (city names in the picker's tooltip are the only named
 * places, and names of cities carry no border disputes). The 15°
 * meridian graticule doubles as the 24 time-sector edges the picker
 * selects between.
 *
 * Everything renders in WHITE-ALPHA strokes/fills on transparent: the
 * SVG is a stencil the globe tints with the live theme's text colour
 * (three's material `color` multiplies the map), so one asset serves
 * dark and light themes without a texture rebuild.
 *
 * The geometry ships as compact [lat, lng] tables projected through
 * `projectToEquirectangular` at module init — deterministic, reviewable
 * diff-wise, and testable as pure math (no parser, no network, no
 * binary asset in the package).
 */

/** Equirectangular raster the SVG rasterizes into (texture canvas size). */
export const SOLAR_GLOBE_MAP_WIDTH = 1024;
export const SOLAR_GLOBE_MAP_HEIGHT = 512;

/** [lat, lng] in degrees, east/north positive. */
export type GlobeMapPoint = readonly [number, number];

/** Map-degree → SVG pixel. Pure; exported for tests. */
export function projectToEquirectangular(latDeg: number, lngDeg: number): [number, number] {
  const x = ((lngDeg + 180) / 360) * SOLAR_GLOBE_MAP_WIDTH;
  const y = ((90 - latDeg) / 180) * SOLAR_GLOBE_MAP_HEIGHT;
  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

// ── Landmass silhouettes (stylized, icon fidelity) ────────────────────────

const LANDMASSES: readonly GlobeMapPoint[][] = [
  // North America
  [[71,-156],[70,-140],[69,-124],[68,-108],[67,-96],[68,-88],[64,-86],[60,-92],[56,-92],[52,-82],[54,-77],[58,-68],[60,-64],[57,-62],[52,-58],[47,-53],[44,-60],[42,-66],[40,-71],[37,-76],[33,-79],[29,-81],[26,-80],[30,-84],[30,-89],[29,-95],[26,-97],[21,-97],[17,-95],[15,-92],[13,-87],[9,-83],[8,-78],[11,-84],[15,-93],[19,-105],[23,-110],[28,-114],[33,-118],[37,-123],[41,-125],[46,-124],[49,-125],[53,-130],[57,-135],[60,-145],[59,-152],[57,-158],[55,-162],[54,-166],[58,-158],[60,-160],[62,-166],[64,-161],[66,-164],[68,-166],[70,-157]],
  // South America
  [[12,-72],[11,-64],[9,-60],[6,-56],[4,-52],[0,-50],[-3,-42],[-5,-36],[-8,-35],[-13,-38],[-18,-39],[-23,-42],[-28,-48],[-33,-53],[-38,-57],[-41,-63],[-45,-65],[-50,-69],[-54,-68],[-55,-71],[-50,-75],[-45,-74],[-40,-73],[-33,-72],[-25,-70],[-19,-70],[-14,-76],[-8,-79],[-4,-81],[1,-80],[5,-78],[8,-77]],
  // Africa
  [[35,-6],[36,0],[37,10],[33,20],[31,25],[31,32],[27,34],[22,37],[18,38],[15,40],[12,44],[11,51],[8,49],[3,46],[-2,41],[-8,40],[-14,40],[-16,40],[-20,35],[-24,35],[-27,33],[-31,30],[-34,26],[-35,20],[-33,18],[-29,17],[-24,15],[-18,12],[-12,13],[-7,12],[-3,9],[1,6],[4,7],[5,0],[5,-5],[7,-11],[10,-15],[14,-17],[17,-16],[21,-17],[25,-15],[28,-12],[31,-10],[33,-9]],
  // Eurasia (coarse Mediterranean, stylized Baltic/Italy; no inland seas)
  [[36,-6],[39,-9],[43,-9],[46,-2],[48,-5],[49,-1],[51,2],[53,5],[55,9],[57,8],[62,5],[66,13],[70,20],[71,28],[69,33],[67,41],[69,45],[70,54],[72,70],[75,85],[77,105],[76,130],[73,140],[70,152],[67,170],[66,178],[64,178],[62,163],[59,152],[54,140],[49,142],[45,137],[43,132],[39,127],[35,126],[38,124],[39,120],[37,118],[34,120],[30,122],[27,120],[23,116],[21,109],[17,108],[12,109],[9,105],[11,103],[13,100],[9,99],[6,100],[1,103],[3,101],[7,98],[13,98],[16,94],[20,93],[22,90],[21,88],[18,86],[15,81],[12,79],[8,77],[10,76],[15,73],[19,72],[22,69],[24,67],[25,61],[22,59],[17,55],[13,49],[12,44],[16,42],[21,38],[26,36],[29,35],[31,34],[35,36],[36,33],[36,29],[38,27],[40,26],[38,22],[40,20],[42,16],[44,13],[42,15],[40,18],[38,17],[40,15],[42,11],[43,9],[44,8],[43,5],[41,3],[39,0],[37,-2]],
  // Australia
  [[-14,127],[-12,130],[-11,132],[-12,137],[-16,139],[-14,142],[-11,142],[-15,145],[-20,149],[-25,153],[-32,153],[-37,150],[-38,145],[-36,140],[-35,137],[-32,134],[-34,124],[-32,119],[-34,116],[-35,113],[-30,115],[-25,113],[-22,114],[-18,122]],
  // Tasmania
  [[-41,145],[-43,147],[-41,148],[-40,146]],
  // New Guinea
  [[-2,131],[-3,136],[-2,141],[-5,145],[-7,147],[-10,150],[-8,144],[-8,139],[-4,135]],
  // Japan arc
  [[45,142],[43,145],[40,142],[37,141],[35,140],[34,137],[33,131],[31,130],[33,130],[35,133],[37,137],[39,140],[42,140],[44,141]],
  // British Isles (merged stylization)
  [[58,-5],[57,-2],[54,0],[52,2],[51,-2],[50,-5],[53,-6],[52,-9],[55,-8],[57,-7]],
  // Iceland
  [[66,-23],[66,-18],[65,-14],[64,-16],[64,-22]],
  // Madagascar
  [[-12,49],[-16,50],[-22,48],[-25,45],[-25,44],[-20,44],[-15,46]],
  // Borneo
  [[2,110],[5,116],[1,119],[-2,116],[-4,112],[-1,109]],
  // Sumatra
  [[5,95],[1,99],[-3,103],[-6,106],[-5,104],[-1,100],[3,96]],
  // Java
  [[-6,105],[-7,110],[-8,114],[-9,114],[-8,108],[-6,105]],
  // Philippines (Luzon + Visayas + Mindanao, one slim arc)
  [[18,121],[16,122],[13,124],[10,125],[7,126],[6,124],[10,122],[14,120],[17,120]],
  // New Zealand (North + South)
  [[-35,173],[-38,178],[-41,175],[-38,174]],
  [[-41,173],[-44,170],[-46,167],[-44,168],[-42,171]],
  // Greenland
  [[60,-44],[63,-51],[66,-53],[70,-54],[74,-58],[77,-66],[76,-70],[72,-56],[68,-52],[65,-40],[61,-42]],
  // Cuba
  [[23,-82],[22,-79],[20,-75],[21,-77],[22,-81]],
  // Sri Lanka
  [[9,80],[7,82],[6,81],[8,80]],
  // Taiwan
  [[25,121],[23,121],[22,120],[24,120]],
  // Antarctica (stylized coast band; no claims drawn — borders don't exist here)
  [[-71,-180],[-69,-120],[-71,-60],[-68,0],[-70,60],[-67,120],[-69,180],[-90,180],[-90,-180]],
  // Antarctic Peninsula
  [[-63,-58],[-68,-62],[-72,-68],[-70,-70],[-65,-64]],
];

// ── Tectonic plate boundaries (stylized) ──────────────────────────────────

const PLATE_BOUNDARIES: readonly GlobeMapPoint[][] = [
  // Mid-Atlantic Ridge → Reykjanes → Mohns/Gakkel Arctic line
  [[-54,4],[-45,-13],[-33,-15],[-22,-16],[-12,-24],[-4,-24],[0,-25],[8,-32],[15,-45],[25,-43],[32,-40],[40,-29],[45,-27],[52,-21],[57,-22],[60,-25],[65,-18],[70,-5],[76,40],[80,80],[76,130],[72,170]],
  // East Pacific Rise → Gulf of California → San Andreas → Cascadia
  [[-60,-117],[-50,-113],[-40,-110],[-32,-109],[-23,-113],[-16,-106],[-8,-102],[0,-100],[8,-103],[15,-106],[20,-111],[24,-109],[28,-114],[32,-117],[36,-122],[40,-126],[45,-124],[48,-127]],
  // NW Pacific margin: Kamchatka → Kurils → Japan → Izu-Ogasawara → Mariana
  [[54,162],[52,158],[49,156],[46,152],[43,148],[41,144],[38,144],[35,141],[33,140],[30,142],[25,142],[21,143],[16,147],[12,141],[8,137],[5,132],[3,128],[0,127]],
  // Tonga–Kermadec → Hikurangi → Alpine fault
  [[-15,-173],[-20,-173],[-26,-176],[-32,-178],[-36,-179],[-40,177],[-42,174],[-44,170],[-46,167]],
  // Andes margin
  [[10,-79],[5,-79],[0,-81],[-5,-81],[-11,-78],[-17,-72],[-23,-70],[-30,-72],[-37,-74],[-44,-75],[-50,-76],[-55,-70]],
  // Scotia arc
  [[-55,-68],[-57,-60],[-58,-48],[-58,-38],[-56,-30],[-54,-26],[-58,-22]],
  // Alpide belt: Anatolia → Zagros → Himalaya → Indochina → Andaman arc
  [[38,25],[36,30],[37,37],[39,44],[38,52],[35,60],[32,67],[30,73],[29,80],[27,88],[25,94],[23,97],[22,100],[18,98],[14,96],[10,95],[7,94],[4,93],[2,95]],
  // Red Sea → Gulf of Aden → Carlsberg → Central Indian → SW Indian → MAR junction
  [[28,34],[24,37],[20,39],[16,42],[13,44],[12,48],[11,52],[10,57],[8,62],[5,66],[2,69],[0,72],[-5,73],[-10,66],[-15,63],[-20,62],[-25,60],[-30,55],[-35,50],[-40,45],[-46,35],[-51,15],[-54,5]],
  // SE Indian Ridge → Australia–Antarctic discordance
  [[-25,60],[-30,68],[-35,80],[-40,95],[-45,110],[-50,125],[-55,140],[-58,155],[-60,165]],
  // East African Rift (stylized single line)
  [[15,40],[11,38],[7,36],[3,36],[-2,34],[-7,32],[-11,32],[-15,32]],
  // Sunda/Java trench arc
  [[2,95],[0,97],[-3,99],[-6,102],[-9,107],[-10,113],[-9,118],[-8,124],[-9,129]],
  // Pacific–Antarctic Ridge → Chile Rise
  [[-60,-140],[-57,-125],[-55,-112],[-56,-101],[-59,-92],[-60,-88],[-55,-86],[-48,-84],[-43,-78]],
];

const PLATE_OPACITY = 0.92;
const PLATE_GLOW_OPACITY = 0.22;
const LAND_FILL_OPACITY = 0.1;
const LAND_STROKE_OPACITY = 0.3;
const SECTOR_LINE_OPACITY = 0.09;
const EQUATOR_OPACITY = 0.14;
const TROPIC_OPACITY = 0.05;

function polylinePath(points: readonly GlobeMapPoint[]): string {
  return points
    .map((p, i) => {
      const [x, y] = projectToEquirectangular(p[0], p[1]);
      return `${i === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");
}

function polygonPath(points: readonly GlobeMapPoint[]): string {
  // East of ±180 wraps with the map: project Chukotka-side points onto
  // the east edge (lng > 180 stays unclamped) so no polygon crosses the
  // seam; the tables above stay within [-180, 180] by construction.
  return `${polylinePath(points)} Z`;
}

/** Meridian lines at the 24 sector EDGES (offset ± 7.5°). */
const SECTOR_EDGE_MERIDIANS: readonly number[] = Array.from(
  { length: 24 },
  (_, k) => k * 15 + 7.5 - 180,
);

function buildSvgInner(): string {
  const parts: string[] = [];
  // Land first (quiet), graticule above it, plate lines on top.
  const land = LANDMASSES.map((poly) => `<path d="${polygonPath(poly)}"/>`).join("");
  parts.push(
    `<g fill="rgba(255,255,255,${LAND_FILL_OPACITY})" stroke="rgba(255,255,255,${LAND_STROKE_OPACITY})" stroke-width="1" stroke-linejoin="round">${land}</g>`,
  );
  const meridians = SECTOR_EDGE_MERIDIANS.map((lng) => {
    const [x] = projectToEquirectangular(0, lng);
    return `M${x} 0 V${SOLAR_GLOBE_MAP_HEIGHT}`;
  }).join(" ");
  const parallels = [-60, -30, 30, 60].map((lat) => {
    const [, y] = projectToEquirectangular(lat, 0);
    return `M0 ${y} H${SOLAR_GLOBE_MAP_WIDTH}`;
  }).join(" ");
  const [, eqY] = projectToEquirectangular(0, 0);
  parts.push(
    `<path d="${parallels}" stroke="rgba(255,255,255,${TROPIC_OPACITY})" stroke-width="1" fill="none"/>`,
    `<path d="${meridians}" stroke="rgba(255,255,255,${SECTOR_LINE_OPACITY})" stroke-width="1" fill="none"/>`,
    `<path d="M0 ${eqY} H${SOLAR_GLOBE_MAP_WIDTH}" stroke="rgba(255,255,255,${EQUATOR_OPACITY})" stroke-width="1" fill="none"/>`,
  );
  const plates = PLATE_BOUNDARIES.map((line) => polylinePath(line)).join(" ");
  // Soft under-glow, then the crisp line — the holo-line pair.
  parts.push(
    `<path d="${plates}" stroke="rgba(255,255,255,${PLATE_GLOW_OPACITY})" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="${plates}" stroke="rgba(255,255,255,${PLATE_OPACITY})" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
  return parts.join("");
}

/** The full standalone SVG document (white-alpha on transparent). */
export function buildSolarGlobeMapSvg(): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SOLAR_GLOBE_MAP_WIDTH} ${SOLAR_GLOBE_MAP_HEIGHT}" preserveAspectRatio="none" role="img" aria-hidden="true">` +
    buildSvgInner() +
    `</svg>`
  );
}

/** Built once per process — static content, no inputs. */
export const SOLAR_GLOBE_MAP_SVG: string = buildSolarGlobeMapSvg();

/** Data URL form for `new Image()` rasterization (no bundler asset
 *  pipeline involved — the SVG travels inside the package as source). */
export function solarGlobeMapDataUrl(): string {
  return `data:image/svg+xml,${encodeURIComponent(SOLAR_GLOBE_MAP_SVG)}`;
}
