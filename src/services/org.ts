export const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'

export const TASK_STATUS_IDS = {
  backlog: '88816179-2233-4631-b0fd-67d84deb2ecb',
  progress: '23b8e459-97ba-4a2d-a5d7-ac2af67392ad',
  review: '04eb2337-83e8-427b-815e-d570725ce402',
  done: '1450a53b-e762-4c98-91f7-2612d5998605',
} as const

export const TASK_PRIORITY_IDS = {
  low: 'c889a929-5b2f-4fc4-af9d-d6120e700662',
  medium: '2ffc330b-ed31-466c-bc31-0bd504de96a5',
  high: 'd8457114-c380-45b2-9794-3d0613838f67',
  urgent: '35612adb-be38-432d-b74e-0a21aae21d40',
} as const

export const STATUS_BY_ID = Object.fromEntries(
  Object.entries(TASK_STATUS_IDS).map(([state, id]) => [id, state]),
) as Record<string, keyof typeof TASK_STATUS_IDS>

export const PRIORITY_BY_ID = Object.fromEntries(
  Object.entries(TASK_PRIORITY_IDS).map(([level, id]) => [id, level]),
) as Record<string, keyof typeof TASK_PRIORITY_IDS>
