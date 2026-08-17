/**
 * Iconos de plataforma vía react-icons.
 * Lucide (lu) para UI general; Simple Icons (si) para marcas.
 */
import type { JSX } from 'react'
import type { IconBaseProps, IconType } from 'react-icons'
import { SiDiscord } from 'react-icons/si'
import {
  LuActivity,
  LuArchive,
  LuArrowDown,
  LuArrowLeft,
  LuArrowLeftRight,
  LuArrowRight,
  LuArrowRightLeft,
  LuArrowUp,
  LuArrowUpDown,
  LuAward,
  LuBadgeCheck,
  LuBeaker,
  LuBell,
  LuBookOpen,
  LuBrain,
  LuCalendar,
  LuCalendarCheck,
  LuCalendarDays,
  LuCalendarRange,
  LuChartBar,
  LuChartColumn,
  LuChartLine,
  LuChartPie,
  LuCheck,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuCircle,
  LuCircleAlert,
  LuCircleCheck,
  LuCircleDashed,
  LuCircleX,
  LuClipboardList,
  LuClock,
  LuClock3,
  LuCloud,
  LuColumns2,
  LuColumns3,
  LuContact,
  LuDatabase,
  LuDownload,
  LuExternalLink,
  LuEye,
  LuEyeOff,
  LuFile,
  LuFileCode,
  LuFileDown,
  LuFileJson,
  LuFileSpreadsheet,
  LuFileText,
  LuFilm,
  LuFilter,
  LuFolder,
  LuFolderLock,
  LuFolderOpen,
  LuFolderPlus,
  LuForward,
  LuGamepad2,
  LuGitCompare,
  LuHandshake,
  LuHardDrive,
  LuHeartHandshake,
  LuHistory,
  LuImage,
  LuInfo,
  LuKeyRound,
  LuLayers,
  LuLayoutDashboard,
  LuLayoutGrid,
  LuLayoutTemplate,
  LuLightbulb,
  LuLink2,
  LuList,
  LuListChecks,
  LuListTodo,
  LuLoader,
  LuLogOut,
  LuMaximize2,
  LuMegaphone,
  LuMenu,
  LuMessageCircle,
  LuMessageSquare,
  LuMinimize2,
  LuMinus,
  LuOctagonAlert,
  LuPackage,
  LuPaintbrush,
  LuPanelRight,
  LuPanelsTopLeft,
  LuPaperclip,
  LuPenLine,
  LuPencil,
  LuPercent,
  LuPlus,
  LuRadio,
  LuReceipt,
  LuRefreshCw,
  LuScale,
  LuScan,
  LuSearch,
  LuSend,
  LuSettings,
  LuShare2,
  LuShield,
  LuShieldAlert,
  LuSlidersHorizontal,
  LuSparkles,
  LuSquareCheck,
  LuStickyNote,
  LuTag,
  LuTarget,
  LuTrash2,
  LuTrendingDown,
  LuTrendingUp,
  LuTriangleAlert,
  LuTrophy,
  LuUpload,
  LuUserCheck,
  LuUserCog,
  LuUserPlus,
  LuUserRound,
  LuUserSearch,
  LuUsers,
  LuVolume2,
  LuVolumeX,
  LuWallet,
  LuWifiOff,
  LuX,
  LuZap,
} from 'react-icons/lu'

export type IconProps = IconBaseProps & {
  strokeWidth?: number
  absoluteStrokeWidth?: boolean
}

export type PlatformIcon = (props: IconProps) => JSX.Element

function compat(Icon: IconType): PlatformIcon {
  function Wrapped({ strokeWidth: _strokeWidth, absoluteStrokeWidth: _absoluteStrokeWidth, ...props }: IconProps) {
    return <Icon {...props} />
  }
  Wrapped.displayName = 'Icon'
  return Wrapped as PlatformIcon
}

export const Discord = compat(SiDiscord)
export const Activity = compat(LuActivity)
export const AlertCircle = compat(LuCircleAlert)
export const AlertOctagon = compat(LuOctagonAlert)
export const AlertTriangle = compat(LuTriangleAlert)
export const Archive = compat(LuArchive)
export const ArrowDown = compat(LuArrowDown)
export const ArrowLeft = compat(LuArrowLeft)
export const ArrowLeftRight = compat(LuArrowLeftRight)
export const ArrowRight = compat(LuArrowRight)
export const ArrowRightLeft = compat(LuArrowRightLeft)
export const ArrowUp = compat(LuArrowUp)
export const ArrowUpDown = compat(LuArrowUpDown)
export const Award = compat(LuAward)
export const BadgeCheck = compat(LuBadgeCheck)
export const BarChart3 = compat(LuChartBar)
export const Beaker = compat(LuBeaker)
export const Bell = compat(LuBell)
export const BookOpen = compat(LuBookOpen)
export const Brain = compat(LuBrain)
export const Calendar = compat(LuCalendar)
export const CalendarCheck = compat(LuCalendarCheck)
export const CalendarDays = compat(LuCalendarDays)
export const CalendarRange = compat(LuCalendarRange)
export const ChartColumn = compat(LuChartColumn)
export const Check = compat(LuCheck)
export const CheckCircle2 = compat(LuCircleCheck)
export const CheckSquare = compat(LuSquareCheck)
export const ChevronDown = compat(LuChevronDown)
export const ChevronLeft = compat(LuChevronLeft)
export const ChevronRight = compat(LuChevronRight)
export const Circle = compat(LuCircle)
export const CircleAlert = compat(LuCircleAlert)
export const CircleDashed = compat(LuCircleDashed)
export const ClipboardList = compat(LuClipboardList)
export const Clock = compat(LuClock)
export const Clock3 = compat(LuClock3)
export const Cloud = compat(LuCloud)
export const Columns2 = compat(LuColumns2)
export const Columns3 = compat(LuColumns3)
export const Contact = compat(LuContact)
export const Database = compat(LuDatabase)
export const Download = compat(LuDownload)
export const ExternalLink = compat(LuExternalLink)
export const Eye = compat(LuEye)
export const EyeOff = compat(LuEyeOff)
export const File = compat(LuFile)
export const FileCode = compat(LuFileCode)
export const FileDown = compat(LuFileDown)
export const FileJson = compat(LuFileJson)
export const FileSpreadsheet = compat(LuFileSpreadsheet)
export const FileText = compat(LuFileText)
export const Film = compat(LuFilm)
export const Filter = compat(LuFilter)
export const Folder = compat(LuFolder)
export const FolderLock = compat(LuFolderLock)
export const FolderOpen = compat(LuFolderOpen)
export const FolderPlus = compat(LuFolderPlus)
export const Forward = compat(LuForward)
export const Gamepad2 = compat(LuGamepad2)
export const GitCompare = compat(LuGitCompare)
export const Handshake = compat(LuHandshake)
export const HardDrive = compat(LuHardDrive)
export const HeartHandshake = compat(LuHeartHandshake)
export const History = compat(LuHistory)
export const Image = compat(LuImage)
export const Info = compat(LuInfo)
export const KeyRound = compat(LuKeyRound)
export const Layers = compat(LuLayers)
export const LayoutDashboard = compat(LuLayoutDashboard)
export const LayoutGrid = compat(LuLayoutGrid)
export const LayoutTemplate = compat(LuLayoutTemplate)
export const Lightbulb = compat(LuLightbulb)
export const LineChart = compat(LuChartLine)
export const Link2 = compat(LuLink2)
export const List = compat(LuList)
export const ListChecks = compat(LuListChecks)
export const ListTodo = compat(LuListTodo)
export const Loader2 = compat(LuLoader)
export const LogOut = compat(LuLogOut)
export const Maximize2 = compat(LuMaximize2)
export const Megaphone = compat(LuMegaphone)
export const Menu = compat(LuMenu)
export const MessageCircle = compat(LuMessageCircle)
export const MessageSquare = compat(LuMessageSquare)
export const Minimize2 = compat(LuMinimize2)
export const Minus = compat(LuMinus)
export const Package = compat(LuPackage)
export const Paintbrush = compat(LuPaintbrush)
export const PanelRight = compat(LuPanelRight)
export const PanelsTopLeft = compat(LuPanelsTopLeft)
export const Paperclip = compat(LuPaperclip)
export const PenLine = compat(LuPenLine)
export const Pencil = compat(LuPencil)
export const Percent = compat(LuPercent)
export const PieChart = compat(LuChartPie)
export const Plus = compat(LuPlus)
export const Radio = compat(LuRadio)
export const Receipt = compat(LuReceipt)
export const RefreshCw = compat(LuRefreshCw)
export const Scale = compat(LuScale)
export const Scan = compat(LuScan)
export const Search = compat(LuSearch)
export const Send = compat(LuSend)
export const Settings = compat(LuSettings)
export const Share2 = compat(LuShare2)
export const Shield = compat(LuShield)
export const ShieldAlert = compat(LuShieldAlert)
export const SlidersHorizontal = compat(LuSlidersHorizontal)
export const Sparkles = compat(LuSparkles)
export const StickyNote = compat(LuStickyNote)
export const Tag = compat(LuTag)
export const Target = compat(LuTarget)
export const Trash2 = compat(LuTrash2)
export const TrendingDown = compat(LuTrendingDown)
export const TrendingUp = compat(LuTrendingUp)
export const Trophy = compat(LuTrophy)
export const Upload = compat(LuUpload)
export const UserCheck = compat(LuUserCheck)
export const UserCog = compat(LuUserCog)
export const UserPlus = compat(LuUserPlus)
export const UserRound = compat(LuUserRound)
export const UserSearch = compat(LuUserSearch)
export const Users = compat(LuUsers)
export const Volume2 = compat(LuVolume2)
export const VolumeX = compat(LuVolumeX)
export const Wallet = compat(LuWallet)
export const WifiOff = compat(LuWifiOff)
export const X = compat(LuX)
export const XCircle = compat(LuCircleX)
export const Zap = compat(LuZap)
