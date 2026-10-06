/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MAP_CONFIG = {
  openFreeMapDarkStyleUrl: 'https://tiles.openfreemap.org/styles/dark',
  esriDarkRasterUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  attribution: 'OpenFreeMap &copy; OpenMapTiles Data from OpenStreetMap &copy; Esri',
  defaultCenter: [40.4168, -3.7038] as [number, number],
  defaultZoom: 6,
  clusterThreshold: 800
};
