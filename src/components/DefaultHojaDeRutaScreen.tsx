import React, { useEffect, useState } from 'react';
import { useOffline } from '../contexts/OfflineContext'; // Asegúrate de que esta ruta sea correcta
import { Box, Card, Typography } from '@mui/material';

export const DefaultHojaDeRutaScreen: React.FC = () => {
    const { smartFetch, isOnline } = useOffline();
    const [hojas, setHojas] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const cargarHoja = async () => {
            setLoading(true);
            try {
                // Usamos smartFetch: primero red, luego caché (clave: 'ruta_del_dia')
                const data = await smartFetch(
                    'hoja_ruta_get', 
                    {}, 
                    'hoja_ruta_cache' 
                );
                setHojas(data);
            } catch (error) {
                console.error("Error cargando la Hoja de Ruta", error);
                // Aquí podrías setear un mensaje de error visible al usuario
            } finally {
                setLoading(false);
            }
        };
        cargarHoja();
    }, [smartFetch]);

    if (loading) return <div>Cargando Hoja de Ruta...</div>;

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h4">Mi Hoja de Ruta {isOnline ? '🟢' : '🔴'}</Typography>
            <Typography variant="subtitle1" sx={{ mb: 3 }}>
                {isOnline ? 'Conectado. Datos actualizados o en caché.' : 'Sin conexión. Mostrando datos offline.'}
            </Typography>
            
            {hojas && hojas.length > 0 ? (
                // Lógica de renderizado de la Hoja (ejemplo)
                hojas.map((item: any, index: number) => (
                    <Card key={index} sx={{ mb: 1, p: 1, border: '1px solid #ccc' }}>
                        <Typography variant="body1">Tarea: {item.tarea || 'N/A'}</Typography>
                        <Typography variant="body2">Dirección: {item.direccion || 'No disponible'}</Typography>
                    </Card>
                ))
            ) : (
                <Typography>No hay tareas asignadas para hoy.</Typography>
            )}
        </Box>
    );
};