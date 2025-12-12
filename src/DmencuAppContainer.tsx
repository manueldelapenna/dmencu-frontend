import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Route } from 'react-router-dom';
import localforage from 'localforage'; // Importamos localforage

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
import { Box } from '@mui/material'; // Usado para el estilo del error

// ----------------------------------------------------------------------
// CONSTANTES Y TIPOS
// ----------------------------------------------------------------------

const APP_MODE_STORAGE_KEY = 'dmencu_app_mode';

export interface PwaScreens {
    syncScreen?: React.ComponentType;
    hojaDeRutaScreen?: React.ComponentType;
}

type BasePropsOmitted = Omit<BaseAppProps, 'myRoutes' | 'myUnloggedRoutes'>;

export interface AppDmencuProps extends BasePropsOmitted {
    pwaScreens?: PwaScreens;
    routesPwa?: React.ReactNode;
    routesPwaUnlogged?: React.ReactNode;
    routesGabinete?: React.ReactNode;
    routesGabineteUnlogged?: React.ReactNode;
}

// ----------------------------------------------------------------------
// 2. COMPONENTE DE LÓGICA INTERNA (DmencuLogic)
// ----------------------------------------------------------------------

const DmencuLogic: React.FC<AppDmencuProps> = ({ 
    pwaScreens,
    routesPwa,
    routesPwaUnlogged,
    routesGabinete,
    routesGabineteUnlogged,
    ...baseProps
}) => {
    // Validación de props de la librería base
    if ((baseProps as BaseAppProps).myRoutes || (baseProps as BaseAppProps).myUnloggedRoutes) {
        console.error(
            "⛔ ERROR DE IMPLEMENTACIÓN EN DMENCU:\n" +
            "No debes pasar 'myRoutes' o 'myUnloggedRoutes' directamente a <AppDmencu />.\n" +
            "Usa 'routesGabinete', 'routesGabineteUnlogged', 'routesPwa' o 'routesPwaUnlogged'."
        );
    }
    
    const { callApi } = useApiCallWithoutSnackbar(); 
    
    // Estados para la lógica de inicio estricta
    const [appMode, setAppMode] = useState<string | null>(null); 
    const [isReady, setIsReady] = useState<boolean>(false);
    const [hasError, setHasError] = useState<boolean>(false); 

    const { myClientSides, myResultsOk, myWScreens} = baseProps;

    // Extensión de componentes (se mantiene igual)
    useEffect(() => {
        if (myClientSides) extendClientSides(myClientSides);
        if (myResultsOk) extendResultsOk(myResultsOk);
        if (myWScreens) extendWScreens(myWScreens);
    }, [myClientSides, myResultsOk, myWScreens]);

    // Función API: Devuelve el modo si es exitoso, null si falla.
    const testApiCall = useCallback(async () => {
        try {
            return await callApi('modo_app_get', {}); 
        } catch (error) {
            console.error("Error obteniendo modo de la API:", error);
            return null;
        }
    }, [callApi]);

    // Lógica de inicialización estricta (LocalForage + API)
    useEffect(() => {
        let isMounted = true;

        const loadModeStrict = async () => {
            setHasError(false);
            
            // 1. Intentar obtener el modo de la API.
            const apiMode = await testApiCall();
            
            if (!isMounted) return;

            if (apiMode) {
                // ÉXITO: Modo de la API obtenido. Persistir.
                await localforage.setItem(APP_MODE_STORAGE_KEY, apiMode);
                setAppMode(apiMode);
                setIsReady(true);
            } else {
                // 2. La API falló. Intentar cargar el modo persistido.
                const savedMode = await localforage.getItem<string>(APP_MODE_STORAGE_KEY);

                if (!isMounted) return;

                if (savedMode) {
                    // FALLBACK ÉXITO: Modo persistido encontrado.
                    setAppMode(savedMode);
                    setIsReady(true);
                } else {
                    // FALLO TOTAL: Ni API ni persistencia.
                    console.error("⛔ FALLO CRÍTICO: No se pudo determinar el modo de la aplicación.");
                    setAppMode(null);
                    setHasError(true);
                    setIsReady(true); // Marcamos como ready para renderizar el error.
                }
            }
        };

        loadModeStrict();
        return () => { isMounted = false; };
    }, [testApiCall]);

    // Sobrescribir componentes PWA
    const SyncComp = pwaScreens?.syncScreen || DefaultSyncScreen;
    const HojaRutaComp = pwaScreens?.hojaDeRutaScreen || DefaultHojaDeRutaScreen;

    // ------------------------------------------------------------------
    // Bloques de rutas por MODO
    // ------------------------------------------------------------------

    // Bloque PWA NO PROTEGIDO
    const pwaUnloggedRoutesBlock = useMemo(() => (
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

    // Bloque Gabinete PROTEGIDO
    const gabineteLoggedRoutesBlock = useMemo(() => (
        <>            
            <Route path="/reportes" element={<div>gabinete privado prueba</div>} />
            {routesGabinete} 
        </>
    ), [routesGabinete]);

    // Rutas públicas: Unión de todos los caminos públicos posibles para el AppProvider
    const allPossiblePublicPaths = useMemo(() => {
        const basePaths = ['/login', '/logout'];
        const gabinetePaths = extractPathsFromRoutes(gabineteUnloggedRoutesBlock);
        const pwaPaths = extractPathsFromRoutes(pwaUnloggedRoutesBlock);
        const pwaCorePaths = ['/relevamiento', '/relevamiento/sync'];
        
        const allPaths = [...basePaths, ...gabinetePaths, ...pwaPaths, ...pwaCorePaths];
        return Array.from(new Set(allPaths.flat()));

    }, [gabineteUnloggedRoutesBlock, pwaUnloggedRoutesBlock]);

    // Rutas protegidas finales (se elige por appMode)
    const finalLoggedRoutes = useMemo(() => {
        if (appMode === 'GABINETE') return gabineteLoggedRoutesBlock; 
        if (appMode === 'RELEVAMIENTO') return pwaLoggedRoutesBlock;
        return null; 
    }, [appMode, gabineteLoggedRoutesBlock, pwaLoggedRoutesBlock]);

    // Rutas no protegidas finales (se elige por appMode)
    const finalUnloggedRoutes = useMemo(() => {
        if (appMode === 'GABINETE') return gabineteUnloggedRoutesBlock;
        if (appMode === 'RELEVAMIENTO') return pwaUnloggedRoutesBlock;
        return null; 
    }, [appMode, gabineteUnloggedRoutesBlock, pwaUnloggedRoutesBlock]);


    // ------------------------------------------------------------------
    // RENDERIZADO CONDICIONAL Y MANEJO DE ERRORES
    // ------------------------------------------------------------------

    if (!isReady) {
        return <Box p={3}>Cargando configuración DMENCU...</Box>;
    }

    if (hasError || !appMode) {
        // Fallo crítico: Informar al usuario
        return (
            <Box 
                sx={{ 
                    p: 4, 
                    textAlign: 'center', 
                    color: 'error.main', 
                    border: '1px solid', 
                    borderColor: 'error.light',
                    borderRadius: 2,
                    m: 4,
                    bgcolor: 'error.background' 
                }}
            >
                <h2>❌ Error de Configuración Crítica</h2>
                <p>No se pudo determinar el modo de operación (Gabinete o Relevamiento).</p>
                <p>Verifique su conexión a Internet y asegúrese de que la configuración inicial esté disponible.</p>
            </Box>
        );
    }

    // ------------------------------------------------------------------
    // Renderizado de la aplicación normal
    // ------------------------------------------------------------------

    return (
        <FrontendPlusProviders publicPaths={allPossiblePublicPaths}>
            <OfflineProvider>
                <FrontendPlusReactRoutes 
                    myRoutes={finalLoggedRoutes} 
                    myUnloggedRoutes={finalUnloggedRoutes} 
                    {...baseProps as BaseAppProps} 
                />
            </OfflineProvider>
        </FrontendPlusProviders>
    );
};

// ----------------------------------------------------------------------
// 3. COMPONENTE EXPORTADO (WRAPPER)
// ----------------------------------------------------------------------

export function AppDmencu(props: AppDmencuProps): React.ReactElement {
    return <DmencuLogic {...props} />;
}