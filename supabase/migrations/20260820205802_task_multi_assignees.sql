-- Multi-responsable: la tabla junction `task_assignments` ya admite N filas por tarea
-- (PK compuesta task_id + user_id). Esta migración documenta el modelo y acelera lecturas.

COMMENT ON TABLE public.task_assignments IS
  'Responsables de una tarea (varios por tarea). PK (task_id, user_id).';

CREATE INDEX IF NOT EXISTS task_assignments_user_id_idx
  ON public.task_assignments (user_id);
