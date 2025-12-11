// dmencu-frontend/src/context/RelevamientoContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useApiCallWithoutSnackbar } from 'frontend-plus-react';

interface HojaDeRuta {
    id: string;
    puntos: any[]; // Tus encuestas/lugares a visitar
}

interface RelevamientoContextProps {
    hojaDeRuta: HojaDeRuta | null;
    respuestasPendientes: any[];
    descargarHojaDeRuta: () => Promise<void>;
    guardarRespuesta: (respuesta: any) => Promise<void>;
    sincronizar: () => Promise<void>;
    isOnline: boolean;
}

const RelevamientoContext = createContext<RelevamientoContextProps | null>(null);

export const RelevamientoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { callApi } = useApiCallWithoutSnackbar();
    const [hojaDeRuta, setHojaDeRuta] = useState<HojaDeRuta | null>(null);
    const [respuestasPendientes, setRespuestasPendientes] = useState<any[]>([]);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Detectar estado online/offline
    useEffect(() => {
        const handleStatusChange = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);
        return () => {
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
        };
    }, []);

    // Cargar datos guardados al iniciar
    useEffect(() => {
        const init = async () => {
            const ruta = await get('hoja_de_ruta');
            const respuestas = await get('respuestas_pendientes') || [];
            if (ruta) setHojaDeRuta(ruta);
            setRespuestasPendientes(respuestas);
        };
        init();
    }, []);

    // 1. DESCARGAR (Sync Down)
    const descargarHojaDeRuta = async () => {
        if (!isOnline) throw new Error("No hay conexión");
        // Llamada al backend real
        const data = await callApi('traer_hoja_ruta', {}); 
        await set('hoja_de_ruta', data); // Guardar en IndexedDB
        setHojaDeRuta(data); // Actualizar estado
    };

    // 2. GUARDAR LOCAL (Offline Action)
    const guardarRespuesta = async (respuesta: any) => {
        const nuevasRespuestas = [...respuestasPendientes, { ...respuesta, timestamp: Date.now() }];
        await set('respuestas_pendientes', nuevasRespuestas);
        setRespuestasPendientes(nuevasRespuestas);
    };

    // 3. SUBIR (Sync Up)
    const sincronizar = async () => {
        if (!isOnline) throw new Error("Requiere internet");
        if (respuestasPendientes.length === 0) return;

        // Enviamos todo al backend
        await callApi('sincronizar_respuestas', { respuestas: respuestasPendientes });

        // Si éxito, limpiamos
        await del('respuestas_pendientes');
        setRespuestasPendientes([]);
        alert("Sincronización exitosa");
    };

    return (
        <RelevamientoContext.Provider value={{ 
            hojaDeRuta, 
            respuestasPendientes, 
            descargarHojaDeRuta, 
            guardarRespuesta, 
            sincronizar,
            isOnline 
        }}>
            {children}
        </RelevamientoContext.Provider>
    );
};

export const useRelevamiento = () => {
    const ctx = useContext(RelevamientoContext);
    if (!ctx) throw new Error("useRelevamiento debe usarse dentro de RelevamientoProvider");
    return ctx;
};