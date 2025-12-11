// dmencu-frontend/src/contexts/OfflineContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { useApiCallWithoutSnackbar } from 'frontend-plus-react';

// 1. Configuración de LocalForage (IndexedDB Wrapper)
localforage.config({
  driver: localforage.INDEXEDDB, // Forzar IndexedDB por capacidad
  name: 'dmencu_storage',
  version: 1.0,
  storeName: 'keyvalue_pairs',
  description: 'Almacenamiento offline para DMENCU'
});

// Definimos la estructura de un item en la cola de sincronización
export interface SyncItem {
    id: string;        // ID único temporal (o real)
    apiMethod: string; // El método del backend a llamar (ej: 'encuesta_guardar')
    payload: any;      // Los datos a enviar
    timestamp: number;
    retries: number;
}

export interface OfflineContextProps {
  isOnline: boolean;
  syncQueue: SyncItem[];
  // Métodos
  smartFetch: <T>(apiMethod: string, params: any, storageKey: string) => Promise<T>;
  addToSyncQueue: (apiMethod: string, payload: any) => Promise<void>;
  processSyncQueue: () => Promise<void>;
  getFromCache: <T>(key: string) => Promise<T | null>;
  saveToCache: (key: string, data: any) => Promise<void>;
  clearCache: (key: string) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextProps | null>(null);

export const OfflineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { callApi } = useApiCallWithoutSnackbar();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState<SyncItem[]>([]);

  // A. Monitor de Conectividad
  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  // B. Cargar la cola guardada al iniciar la app
  useEffect(() => {
    const loadQueue = async () => {
      const queue = await localforage.getItem<SyncItem[]>('sync_queue');
      if (queue) setSyncQueue(queue);
    };
    loadQueue();
  }, []);

  // --- FUNCIONES CORE ---

  // 1. Smart Fetch (Lectura: Network First -> Cache Fallback)
  // Ideal para: Hojas de ruta, listas de precios, configuraciones.
  const smartFetch = useCallback(async <T,>(apiMethod: string, params: any, storageKey: string): Promise<T> => {
    // Si hay internet, intentamos buscar el dato fresco
    if (navigator.onLine) {
      try {
        console.log(`[SmartFetch] Buscando online: ${apiMethod}`);
        const data = await callApi(apiMethod, params);
        
        // Si éxito, actualizamos la caché silenciosamente
        await localforage.setItem(storageKey, data);
        return data as T;
      } catch (error) {
        console.warn(`[SmartFetch] Falló API (${apiMethod}), intentando offline...`);
        // Si falla la API (ej: timeout o 500), caemos al catch de abajo
      }
    }

    // Si no hay red O falló la API, leemos de disco
    console.log(`[SmartFetch] Leyendo caché: ${storageKey}`);
    const cachedData = await localforage.getItem<T>(storageKey);
    
    if (!cachedData) {
      throw new Error(`No hay datos offline disponibles para: ${storageKey}`);
    }
    return cachedData;
  }, [callApi]);

  // 2. Add to Sync Queue (Escritura Offline)
  // Ideal para: Guardar encuestas, fichar ingreso, check-ins.
  const addToSyncQueue = async (apiMethod: string, payload: any) => {
    const newItem: SyncItem = {
        id: crypto.randomUUID(), // Genera un ID único v4
        apiMethod,
        payload,
        timestamp: Date.now(),
        retries: 0
    };

    const newQueue = [...syncQueue, newItem];
    setSyncQueue(newQueue); // Actualiza estado React
    await localforage.setItem('sync_queue', newQueue); // Persiste en DB
    console.log("[Offline] Item agregado a la cola", newItem);
  };

  // 3. Procesar Cola (Sincronización)
  const processSyncQueue = async () => {
    if (!isOnline) throw new Error("No hay conexión para sincronizar");
    if (syncQueue.length === 0) return;

    console.log("[Sync] Iniciando sincronización...", syncQueue.length, "items");
    
    // Estrategia: Procesar uno por uno para asegurar orden (FIFO)
    // Si uno falla, detenemos la cola para no romper consistencia (opcional)
    const pendingQueue = [...syncQueue];
    const failedItems: SyncItem[] = [];

    for (const item of pendingQueue) {
        try {
            await callApi(item.apiMethod, item.payload);
            console.log(`[Sync] Item ${item.id} enviado con éxito`);
        } catch (error) {
            console.error(`[Sync] Falló item ${item.id}`, error);
            item.retries++;
            failedItems.push(item); // Lo mantenemos para el futuro
        }
    }

    // Actualizamos la cola con lo que sobró (si algo falló)
    setSyncQueue(failedItems);
    await localforage.setItem('sync_queue', failedItems);

    if (failedItems.length === 0) {
        console.log("[Sync] Sincronización completada exitosamente.");
    } else {
        throw new Error(`Se sincronizaron algunos items, pero ${failedItems.length} fallaron.`);
    }
  };

  // Helpers directos
  const getFromCache = async <T,>(key: string) => await localforage.getItem<T>(key);
  const saveToCache = async (key: string, data: any) => await localforage.setItem(key, data);
  const clearCache = async (key: string) => await localforage.removeItem(key);

  return (
    <OfflineContext.Provider value={{ 
        isOnline, 
        syncQueue, 
        smartFetch, 
        addToSyncQueue, 
        processSyncQueue,
        getFromCache,
        saveToCache,
        clearCache
    }}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = () => {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline debe usarse dentro de OfflineProvider");
  return ctx;
};