/** @module Interface hikari:scene3d/types **/
export interface FleetRow {
  nodeId: string,
  tier: number,
  stationCount: number,
  label?: string,
  status?: string,
  online?: boolean,
  detail?: string,
}
export interface FleetBodySpec {
  id: string,
  label: string,
  status: string,
  online: boolean,
  detail: string,
  role: string,
  color: [number, number, number],
  radius: number,
  orbitCenter: [number, number, number],
  orbitRadius: number,
  orbitPeriodSec: number,
  orbitPhase: number,
  orbitTilt: number,
  spinPeriodSec: number,
  satellites: number,
  satelliteTotal: number,
}
export interface FleetSceneSpec {
  stars: Array<FleetBodySpec>,
  planets: Array<FleetBodySpec>,
  hasRegistryCore: boolean,
}
