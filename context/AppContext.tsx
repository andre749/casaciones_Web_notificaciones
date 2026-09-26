'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
  Usuario,
  Alerta,
  Notificacion,
  usuarioMock,
} from '@/data/mockData';

// ============================================================
// APP CONTEXT - Estado global de la aplicación
// Maneja el estado del usuario, alertas y notificaciones.
// En producción, esto se conectaría a un backend real.
// ============================================================

interface AppContextType {
  // Estado del usuario
  usuario: Usuario;
  setUsuario: React.Dispatch<React.SetStateAction<Usuario>>;

  // Estado de alertas (expedientes monitoreados)
  alertas: Alerta[];
  agregarAlerta: (alerta: Omit<Alerta, 'id' | 'fechaRegistro' | 'ultimaRevision'>) => boolean;
  eliminarAlerta: (id: string) => void;
  toggleEstadoAlerta: (id: string) => void;

  // Estado de notificaciones
  notificaciones: Notificacion[];
  notificacionesNoLeidas: number;
  marcarComoLeida: (id: string) => void;
  marcarTodasComoLeidas: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario>(usuarioMock);
  // Usuario nuevo: arranca sin casos monitoreados ni notificaciones.
  // (alertasMock / notificacionesMock quedan en mockData.ts como referencia de demo)
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);

  // Contador de notificaciones no leídas
  const notificacionesNoLeidas = notificaciones.filter((n) => !n.leida).length;

  // Agregar nueva alerta de monitoreo
  const agregarAlerta = useCallback(
    (nuevaAlerta: Omit<Alerta, 'id' | 'fechaRegistro' | 'ultimaRevision'>): boolean => {
      const ahora = new Date().toISOString();
      const alerta: Alerta = {
        ...nuevaAlerta,
        id: `alr_${Date.now()}`,
        fechaRegistro: ahora,
        ultimaRevision: ahora,
        costoTokens: nuevaAlerta.costoTokens ?? 0,
      };

      setAlertas((prev) => [alerta, ...prev]);
      return true;
    },
    []
  );

  // Eliminar alerta
  const eliminarAlerta = useCallback((id: string) => {
    setAlertas((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Alternar estado de alerta entre activo y pausado
  const toggleEstadoAlerta = useCallback((id: string) => {
    setAlertas((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a;
        return {
          ...a,
          estado: a.estado === 'activo' ? 'pausado' : 'activo',
        };
      })
    );
  }, []);

  // Marcar notificación como leída
  const marcarComoLeida = useCallback((id: string) => {
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
    );
  }, []);

  // Marcar todas las notificaciones como leídas
  const marcarTodasComoLeidas = useCallback(() => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
  }, []);

  return (
    <AppContext.Provider
      value={{
        usuario,
        setUsuario,
        alertas,
        agregarAlerta,
        eliminarAlerta,
        toggleEstadoAlerta,
        notificaciones,
        notificacionesNoLeidas,
        marcarComoLeida,
        marcarTodasComoLeidas,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// Hook personalizado para usar el contexto
export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp debe usarse dentro de un AppProvider');
  }
  return context;
}
