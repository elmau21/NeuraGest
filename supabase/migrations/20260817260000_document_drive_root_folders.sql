-- Carpetas raíz personalizadas en Document Drive (junto a Contratos / Directivas / Extras).

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS is_root_custom boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.documents.is_root_custom IS
  'true solo en carpetas raíz creadas por el usuario (no en las 3 categorías fijas del sistema).';

-- Ampliar índice de nombres únicos por hermanos para incluir category = Root
DROP INDEX IF EXISTS documents_drive_sibling_name_uidx;
CREATE UNIQUE INDEX documents_drive_sibling_name_uidx
  ON public.documents (
    organization_id,
    category,
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(title)
  )
  WHERE deleted_at IS NULL
    AND kind IS NOT NULL
    AND category IN ('Contratos', 'Directivas', 'Extras', 'Root');

CREATE INDEX IF NOT EXISTS documents_drive_root_custom_idx
  ON public.documents (organization_id)
  WHERE deleted_at IS NULL
    AND kind = 'folder'
    AND is_root_custom = true;
