import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Route } from 'react-router-dom';
import { 
    FrontendPlusProviders, 
    FrontendPlusReactRoutes, 
    useApiCallWithoutSnackbar,
    AppProps as BaseAppProps, 
    extendWScreens, 
    extendClientSides, 
    extendResultsOk,
    extractPathsFromRoutes
} from 'frontend-plus-react'; 

import { OfflineProvider } from './contexts/OfflineContext';
import { DefaultSyncScreen } from './components/DefaultSyncScreen';
import { DefaultHojaDeRutaScreen } from './components/DefaultHojaDeRutaScreen';




// 1. Agrupamos los componentes PWA reemplazables
export interface PwaScreens {
    syncScreen?: React.ComponentType;        // Opcional
    hojaDeRutaScreen?: React.ComponentType;  // Opcional
    // configScreen?: React.ComponentType;   // Futuro
}

type BasePropsOmitted = Omit<BaseAppProps, 'myRoutes' | 'myUnloggedRoutes'>;

export interface AppDmencuProps extends BasePropsOmitted {
    pwaScreens?: PwaScreens;
    routesPwa?: React.ReactNode;
    routesPwaUnlogged?: React.ReactNode;
    routesGabinete?: React.ReactNode;
    routesGabineteUnlogged?: React.ReactNode;
}

const DEFAULT_MODE = 'GABINETE'; 

// 2. COMPONENTE DE LÓGICA INTERNA
const DmencuLogic: React.FC<AppDmencuProps> = ({ 
    pwaScreens,
    routesPwa,
    routesPwaUnlogged,
    routesGabinete,
    routesGabineteUnlogged,
    ...baseProps
}) => {
    if ((baseProps as BaseAppProps).myRoutes || (baseProps as BaseAppProps).myUnloggedRoutes) {
        console.error(
            "⛔ ERROR DE IMPLEMENTACIÓN EN DMENCU:\n" +
            "No debes pasar 'myRoutes' o 'myUnloggedRoutes' directamente a <AppDmencu />.\n" +
            "Usa 'routesGabinete' (para admin), 'routesGabineteUnlogged' (para público) o 'routesPwa'."
        );
    }
    const { callApi } = useApiCallWithoutSnackbar(); 
    const [appMode, setAppMode] = useState<string | null>(null); 
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const { myClientSides, myResultsOk, myWScreens} = baseProps;

    useEffect(() => {
        if (myClientSides) extendClientSides(myClientSides);
        if (myResultsOk) extendResultsOk(myResultsOk);
        if (myWScreens) extendWScreens(myWScreens);
    }, [myClientSides, myResultsOk, myWScreens]);

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

    //sobrescribo componentes si corresponde
    const SyncComp = pwaScreens?.syncScreen || DefaultSyncScreen;
    const HojaRutaComp = pwaScreens?.hojaDeRutaScreen || DefaultHojaDeRutaScreen;

   // Bloque PWA NO PROTEGIDO (Va al slot Unlogged de la base)
    const pwaUnloggedRoutesBlock = useMemo(() => (
        // Las rutas clave de la PWA (Hoja de Ruta, Sincro, etc.)
        <>
            <Route path="/relevamiento">
                <Route index element={<HojaRutaComp />} /> 
                <Route path="sync" element={<SyncComp />} />
                {routesPwaUnlogged}
            </Route>
        </>
    ), [SyncComp, HojaRutaComp, routesPwaUnlogged]);

    // Bloque PWA PROTEGIDO
    const pwaLoggedRoutesBlock = useMemo(() => (
        <>
            <Route path="/pwa-privado">
                <Route index element={<div>privado pwa prueba</div>} /> 
                {routesPwa}
            </Route>
        </>
    ), [routesPwa]);

    // Bloque Gabinete NO PROTEGIDO
    const gabineteUnloggedRoutesBlock = useMemo(() => (
        <>
            <Route path="/public" element={<div>gabinete publico prueba</div>} />
            {routesGabineteUnlogged}
        </>
    ), [routesGabineteUnlogged]);

    //Bloque Gabinete PROTEGIDO
    const gabineteLoggedRoutesBlock = useMemo(() => (
        <>            
            <Route path="/reportes" element={<div>gabinete privado prueba</div>} />
            {/* Rutas adicionales de Gabinete definidas por app final */}
            {routesGabinete} 
        </>
    ), [routesGabinete]);

    const allPossiblePublicPaths = useMemo(() => {
        // Rutas públicas base (siempre existen)
        const basePaths = ['/login', '/logout'];

        // Extraer rutas de Gabinete NO logueadas
        const gabinetePaths = extractPathsFromRoutes(gabineteUnloggedRoutesBlock);
        
        // Extraer rutas de PWA NO logueadas
        // (Añadir las rutas base de la PWA que definiste en el bloque)
        const pwaPaths = extractPathsFromRoutes(pwaUnloggedRoutesBlock);
        
        // Asegurarse de que las rutas clave de PWA estén incluidas
        const pwaCorePaths = ['/relevamiento', '/relevamiento/sync'];
        
        // Juntamos y desduplicamos
        const allPaths = [...basePaths, ...gabinetePaths, ...pwaPaths, ...pwaCorePaths];
        
        // Usamos Set para desduplicar y convertir de nuevo a array
        return Array.from(new Set(allPaths.flat()));

    }, [gabineteUnloggedRoutesBlock, pwaUnloggedRoutesBlock]);

   const finalLoggedRoutes = useMemo(() => {
        if (appMode === 'GABINETE') {
            return gabineteLoggedRoutesBlock; 
        }
        if (appMode === 'RELEVAMIENTO') {
            return pwaLoggedRoutesBlock
        }

    }, [appMode, gabineteLoggedRoutesBlock, pwaLoggedRoutesBlock]);

    const finalUnloggedRoutes = useMemo(() => {
        if (appMode === 'GABINETE') {
            return gabineteUnloggedRoutesBlock;
        }
        if (appMode === 'RELEVAMIENTO') { 
            return pwaUnloggedRoutesBlock;
        }
        
    }, [appMode, gabineteUnloggedRoutesBlock,pwaUnloggedRoutesBlock]);

    if (isLoading) return <div>Cargando configuración DMENCU...</div>;

    return (
        <FrontendPlusProviders publicPaths={allPossiblePublicPaths}>
            <OfflineProvider>
                <FrontendPlusReactRoutes myRoutes={finalLoggedRoutes} myUnloggedRoutes={finalUnloggedRoutes} {...baseProps as BaseAppProps} />
            </OfflineProvider>
        </FrontendPlusProviders>
    );
};

// 3. COMPONENTE EXPORTADO (WRAPPER)
export function AppDmencu(props: AppDmencuProps): React.ReactElement {
    // Ya no necesitas FrontendPlusProviders aquí, solo renderizas DmencuLogic
    return <DmencuLogic {...props} />;
}