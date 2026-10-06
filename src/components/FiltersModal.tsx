// src/components/FiltersModal.tsx
import React, { useState, useCallback } from 'react';

export interface FlightFilters {
  altitudeMin: number;
  altitudeMax: number;
  airline: string;
}

interface FiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyFilters: (filters: FlightFilters) => void;
  initialFilters?: FlightFilters;
}

export const FiltersModal: React.FC<FiltersModalProps> = ({
  isOpen,
  onClose,
  onApplyFilters,
  initialFilters = { altitudeMin: 0, altitudeMax: 45000, airline: '' }
}) => {
  const [filters, setFilters] = useState<FlightFilters>(initialFilters);

  const handleChange = useCallback((field: keyof FlightFilters, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleApply = useCallback(() => {
    onApplyFilters(filters);
    onClose();
  }, [filters, onApplyFilters, onClose]);

  if (!isOpen) return null;

  return (
    <div className="filters-modal-overlay" role="dialog" aria-modal="true">
      <div className="filters-modal-content">
        <h3>Filtros Avanzados de Aeronaves</h3>
        
        <div className="filter-group">
          <label htmlFor="altitudeMin">Altitud Mínima (pies):</label>
          <input 
            id="altitudeMin"
            type="number" 
            value={filters.altitudeMin} 
            onChange={(e) => handleChange('altitudeMin', Number(e.target.value))} 
          />
        </div>

        <div className="filter-group">
          <label htmlFor="altitudeMax">Altitud Máxima (pies):</label>
          <input 
            id="altitudeMax"
            type="number" 
            value={filters.altitudeMax} 
            onChange={(e) => handleChange('altitudeMax', Number(e.target.value))} 
          />
        </div>

        <div className="filter-group">
          <label htmlFor="airline">Aerolínea / Código OACI:</label>
          <input 
            id="airline"
            type="text" 
            placeholder="Ej. IBE, DLH"
            value={filters.airline} 
            onChange={(e) => handleChange('airline', e.target.value.toUpperCase())} 
          />
        </div>

        <div className="modal-actions">
          <button className="btn-primary" onClick={handleApply}>Aplicar Filtros</button>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
};
