import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    FrontendPlusProviders, 
    FrontendPlusReactRoutes, 
    useApiCallWithoutSnackbar,
    // Importamos los tipos y las funciones de extensión de la librería base
    AppProps as BaseAppProps, 
    extendWScreens, 
    extendClientSides, 
    extendResultsOk
} from 'frontend-plus-react'; 
import { GabineteRoutesBlock, PwaRoutesBlock } from './dmencu-routes';

// 1. DEFINIMOS LA INTERFAZ EXTENDIDA
// Esto le dice a TypeScript: "Acepto todo lo que frontend-plus acepta, más lo mío".
export interface AppDmencuProps extends BaseAppProps {
    // Aquí podrías agregar props exclusivas de Dmencu si hicieran falta en el futuro
    // Por ejemplo: pwaConfig?: any;
}

const DEFAULT_MODE = 'GABINETE'; 

// 2. COMPONENTE DE LÓGICA INTERNA
const DmencuLogic: React.FC<AppDmencuProps> = ({ 
    myRoutes, 
    myWScreens, 
    myClientSides, 
    myResultsOk 
}) => {
    const { callApi } = useApiCallWithoutSnackbar(); 
    const [appMode, setAppMode] = useState<string | null>(null); 
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // --- A. LÓGICA DE EXTENSIÓN (Igual que hacía la App base) ---
    // Como estamos "suplantando" al componente App original, debemos hacernos cargo
    // de registrar los componentes personalizados que vienen de Repsic.
    useEffect(() => {
        if (myClientSides) extendClientSides(myClientSides);
        if (myResultsOk) extendResultsOk(myResultsOk);
        if (myWScreens) extendWScreens(myWScreens);
    }, [myClientSides, myResultsOk, myWScreens]);

    // --- B. LÓGICA DE API (Tu MOCK/REAL) ---
    const testApiCall = useCallback(async () => {
        try {
            return await callApi('modo_app_get', {}); 
        } catch (error) {
            console.error("Error obteniendo modo:", error);
            return DEFAULT_MODE;
        }
    }, [callApi]);

    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            setIsLoading(true);
            try {
                const modo = await testApiCall();
                if(isMounted) setAppMode(modo);
            } catch {
                if(isMounted) setAppMode(DEFAULT_MODE);
            } finally {
                if(isMounted) setIsLoading(false);
            }
        };
        init();
        return () => { isMounted = false; };
    }, [testApiCall]);

    // --- C. FUSIÓN DE RUTAS ---
    const dmencuRoutesBlock = appMode === 'PWA' ? PwaRoutesBlock : GabineteRoutesBlock;

    const mergedRoutes = useMemo(() => (
        <>
            {/* 1. Las rutas base de Dmencu (según el modo) */}
            {dmencuRoutesBlock}
            
            {/* 2. Las rutas específicas de la app final inyectadas */}
            {myRoutes} 
        </>
    ), [dmencuRoutesBlock, myRoutes]);

    if (isLoading) return <div>Cargando configuración DMENCU...</div>;

    return <FrontendPlusReactRoutes myRoutes={mergedRoutes} />;
};

// 3. COMPONENTE EXPORTADO (WRAPPER)
export function AppDmencu(props: AppDmencuProps): React.ReactElement {
    return (
        <FrontendPlusProviders>
            {/* Pasamos TODAS las props hacia abajo */}
            <DmencuLogic {...props} />
        </FrontendPlusProviders>
    );
}