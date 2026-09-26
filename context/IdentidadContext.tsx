'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// ============================================================
// IDENTIDAD CONTEXT - Estado global de verificación de identidad
// Maneja si el usuario ha validado su DNI/CE para poder
// usar funciones protegidas como crear alertas de monitoreo.
// Persiste en localStorage para que no tenga que re-validar.
// ============================================================

export interface DatosIdentidad {
  tipoDocumento: string;
  numeroDocumento: string;
  fechaEmision: string;
  fechaNacimiento: string;
  guardadoEn: string;
}

interface IdentidadContextType {
  identidad: DatosIdentidad | null;
  cargado: boolean;
  tieneIdentidad: boolean;
  guardarIdentidad: (datos: Omit<DatosIdentidad, 'guardadoEn'>) => void;
  limpiarIdentidad: () => void;
}

const IdentidadContext = createContext<IdentidadContextType | undefined>(undefined);

const STORAGE_KEY = 'pj_identidad_consultante';

export function IdentidadProvider({ children }: { children: ReactNode }) {
  const [identidad, setIdentidadState] = useState<DatosIdentidad | null>(null);
  const [cargado, setCargado] = useState(false);

  // Cargar identidad desde localStorage al montar
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DatosIdentidad;
        setIdentidadState(parsed);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setCargado(true);
    }
  }, []);

  // Guardar identidad validada
  const guardarIdentidad = useCallback((datos: Omit<DatosIdentidad, 'guardadoEn'>) => {
    const completo: DatosIdentidad = {
      ...datos,
      guardadoEn: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completo));
    setIdentidadState(completo);
  }, []);

  // Limpiar identidad (cerrar sesión de identidad)
  const limpiarIdentidad = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIdentidadState(null);
  }, []);

  return (
    <IdentidadContext.Provider
      value={{
        identidad,
        cargado,
        tieneIdentidad: identidad !== null,
        guardarIdentidad,
        limpiarIdentidad,
      }}
    >
      {children}
    </IdentidadContext.Provider>
  );
}

// Hook personalizado para usar el contexto de identidad
export function useIdentidad(): IdentidadContextType {
  const context = useContext(IdentidadContext);
  if (!context) {
    throw new Error('useIdentidad debe usarse dentro de un IdentidadProvider');
  }
  return context;
}
