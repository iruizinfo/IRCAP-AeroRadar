// src/components/MapView.tsx (Fragmento optimizado de actualización de fuentes)
import React, { useEffect, useRef } from 'react';

interface MapViewProps {
  aircrafts: Array<{ id: string; longitude: number; latitude: number; [key: string]: any }>;
}

export const MapView: React.FC<MapViewProps> = ({ aircrafts }) => {
  const requestRef = useRef<number>(0);
  const latestAircrafts = useRef(aircrafts);

  // Mantener siempre la referencia más actualizada sin forzar re-renders del componente React
  latestAircrafts.current = aircrafts;

  useEffect(() => {
    const updateMapLayer = () => {
      // Aquí se actualizaría la fuente de datos GeoJSON de MapLibre de forma eficiente por lotes
      // Ejemplo: 
      // const source = map.current?.getSource('aircrafts-source');
      // if (source) {
      //   source.setData({
      //     type: 'FeatureCollection',
      //     features: latestAircrafts.current.map(ac => ({
      //       type: 'Feature',
      //       geometry: { type: 'Point', coordinates: [ac.longitude, ac.latitude] },
      //       properties: { ...ac }
      //     }))
      //   });
      // }

      requestRef.current = requestAnimationFrame(updateMapLayer);
    };

    requestRef.current = requestAnimationFrame(updateMapLayer);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, []);

  return (
    <div 
      id="map-container" 
      style={{ width: '100%', height: '100vh', position: 'relative' }} 
      aria-label="Mapa de Radar Aéreo"
    />
  );
};
