// dmencu-frontend/src/dmencu-routes.tsx

import React from 'react';
import { Route } from 'react-router-dom';

const HojaRutaPage = () => <div>DMENCU: Rutas de Relevamiento</div>;
const ReportesPage = () => <div>DMENCU: Rutas de Gabinete</div>;

// Bloque de Rutas PWA (Relevamiento)
export const PwaRoutesBlock = (
    <>
        <Route path="/hoja-ruta" element={<HojaRutaPage />} />
        <Route path="/" element={<HojaRutaPage />} /> 
    </>
);

// Bloque de Rutas de Gabinete (Web)
export const GabineteRoutesBlock = (
    <>
        <Route path="/reportes" element={<ReportesPage />} />
    </>
);