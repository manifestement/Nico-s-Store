import type { SVGProps } from 'react'
import type { CategoryIcon } from '../db/repo'

type P = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, strokeWidth = 2, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const PlusIcon = (p: P) => <Svg strokeWidth={2.4} {...p}><path d="M12 5v14M5 12h14" /></Svg>
export const SearchIcon = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Svg>
export const FilterIcon = (p: P) => <Svg {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Svg>
export const SortIcon = (p: P) => <Svg {...p}><path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" /></Svg>
export const ChevronDown = (p: P) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
export const ChevronLeft = (p: P) => <Svg {...p}><path d="M15 6l-6 6 6 6" /></Svg>
export const ChevronUp = (p: P) => <Svg {...p}><path d="M6 15l6-6 6 6" /></Svg>
export const EditIcon = (p: P) => <Svg {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /></Svg>
export const TrashIcon = (p: P) => <Svg {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></Svg>
export const CameraIcon = (p: P) => <Svg {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></Svg>
export const GalleryIcon = (p: P) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></Svg>
export const ExternalIcon = (p: P) => <Svg {...p}><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" /></Svg>
export const CheckIcon = (p: P) => <Svg strokeWidth={2.2} {...p}><path d="M5 12l5 5L20 7" /></Svg>
export const ClockIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
export const GridIcon = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Svg>
)
export const HeartIcon = (p: P) => <Svg {...p}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></Svg>
export const GearIcon = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
  </Svg>
)

const CATEGORY_PATHS: Record<CategoryIcon, React.ReactNode> = {
  shoe: (
    <>
      <path d="M3 16.5c0-1.5.8-2.5 2-3l3-1.5 2-4 2.5 1 1 2.5 3.5 1.5c2 .8 4 1.6 4 3.5V18H3z" />
      <path d="M3 18h18" />
    </>
  ),
  cloth: <path d="M8 3l-5 3 2 4 3-1v12h8V9l3 1 2-4-5-3c-.6 1.5-2.2 2.5-4 2.5S8.6 4.5 8 3z" />,
  bag: (
    <>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
  box: (
    <>
      <path d="M3 7l9-4 9 4-9 4z" />
      <path d="M3 7v10l9 4 9-4V7M12 11v10" />
    </>
  ),
  star: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" />,
}

export function CategoryGlyph({ icon, ...p }: P & { icon: CategoryIcon }) {
  return (
    <Svg strokeWidth={1.7} {...p}>
      {CATEGORY_PATHS[icon]}
    </Svg>
  )
}

export const CATEGORY_ICONS: CategoryIcon[] = ['shoe', 'cloth', 'bag', 'box', 'star']
