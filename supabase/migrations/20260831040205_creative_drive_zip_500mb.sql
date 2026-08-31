-- Permite ZIP de hasta 500 MB en el bucket creative-drive (Diseño gráfico).
-- Los demás tipos siguen validándose en cliente según reglas Twitch al marcar "Listo para Twitch".

UPDATE storage.buckets
SET file_size_limit = 524288000
WHERE id = 'creative-drive';
