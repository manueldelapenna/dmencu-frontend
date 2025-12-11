import React, { useState } from 'react';
import { useOffline } from '../contexts/OfflineContext';
import { Box, Button, Typography, Card, CardContent } from '@mui/material';

export const DefaultSyncScreen: React.FC = () => {
    const { syncQueue, processSyncQueue, isOnline } = useOffline();
    const [syncing, setSyncing] = useState(false);

    const handleSync = async () => {
        setSyncing(true);
        try {
            await processSyncQueue();
            alert("Sincronización finalizada con éxito");
        } catch (e) {
            alert("Error al sincronizar");
        } finally {
            setSyncing(false);
        }
    };

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5">Centro de Sincronización</Typography>
            <Box sx={{ my: 2, color: isOnline ? 'green' : 'red' }}>
                {isOnline ? '🟢 Conectado' : '🔴 Sin Conexión'}
            </Box>
            <Card>
                <CardContent>
                    <Typography>Pendientes de envío: {syncQueue.length}</Typography>
                    <Button 
                        variant="contained" 
                        fullWidth 
                        sx={{ mt: 2 }}
                        onClick={handleSync}
                        disabled={!isOnline || syncQueue.length === 0 || syncing}
                    >
                        {syncing ? 'Sincronizando...' : 'Subir Datos'}
                    </Button>
                </CardContent>
            </Card>
        </Box>
    );
};