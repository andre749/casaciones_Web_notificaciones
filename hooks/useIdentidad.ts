// ============================================================
// HOOK useIdentidad
// Re-exporta el hook del IdentidadContext para que todos los
// componentes compartan un único estado global de validación
// (antes cada componente tenía su propia copia local).
// ============================================================

export { useIdentidad } from '@/context/IdentidadContext';
export type { DatosIdentidad } from '@/context/IdentidadContext';
