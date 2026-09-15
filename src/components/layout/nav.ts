import {
  Cake,
  CalendarDays,
  Earth,
  HardDrive,
  Heart,
  Hourglass,
  House,
  Images,
  MapPin,
  Search,
  Sparkles,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; key: string; icon: LucideIcon };

export const mainNav: NavItem[] = [
  { href: "/home", key: "home", icon: House },
  { href: "/albums", key: "albums", icon: Images },
  { href: "/timeline", key: "timeline", icon: CalendarDays },
  { href: "/places", key: "places", icon: MapPin },
  { href: "/favorites", key: "favorites", icon: Heart },
  { href: "/search", key: "search", icon: Search },
];

export const memoriesNav: NavItem[] = [
  { href: "/milestones", key: "milestones", icon: Cake },
  { href: "/capsules", key: "capsules", icon: Hourglass },
  { href: "/recap", key: "recap", icon: Sparkles },
  { href: "/globe", key: "globe", icon: Earth },
];

export const adminNav: NavItem[] = [
  { href: "/family", key: "family", icon: Users },
  { href: "/trash", key: "trash", icon: Trash2 },
  { href: "/storage", key: "storage", icon: HardDrive },
];

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);
