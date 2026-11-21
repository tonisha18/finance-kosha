export type CategoryName =
  | "Food & Dining"
  | "Groceries"
  | "Rent & Housing"
  | "Utilities"
  | "Transport"
  | "Shopping"
  | "Entertainment & Subscriptions"
  | "Healthcare"
  | "Income/Salary"
  | "Transfers";

export interface CategoryDef {
  name: CategoryName;
  color: string;
  iconName: string;
  isEssential: boolean;
}

export const CATEGORIES: Record<CategoryName, CategoryDef> = {
  "Food & Dining": {
    name: "Food & Dining",
    color: "#0F172A", // midnight
    iconName: "Utensils",
    isEssential: false,
  },
  "Groceries": {
    name: "Groceries",
    color: "#334155", // slate dark
    iconName: "ShoppingBag",
    isEssential: true,
  },
  "Rent & Housing": {
    name: "Rent & Housing",
    color: "#1E293B", // deep slate
    iconName: "Home",
    isEssential: true,
  },
  "Utilities": {
    name: "Utilities",
    color: "#475569", // slate neutral
    iconName: "Zap",
    isEssential: true,
  },
  "Transport": {
    name: "Transport",
    color: "#64748B", // slate medium
    iconName: "Car",
    isEssential: true,
  },
  "Shopping": {
    name: "Shopping",
    color: "#94A3B8", // slate light
    iconName: "Package",
    isEssential: false,
  },
  "Entertainment & Subscriptions": {
    name: "Entertainment & Subscriptions",
    color: "#4B5563", // charcoal
    iconName: "Tv",
    isEssential: false,
  },
  "Healthcare": {
    name: "Healthcare",
    color: "#020617", // black obsidian
    iconName: "HeartPulse",
    isEssential: true,
  },
  "Income/Salary": {
    name: "Income/Salary",
    color: "#0F172A", // primary dark
    iconName: "Wallet",
    isEssential: false,
  },
  "Transfers": {
    name: "Transfers",
    color: "#9CA3AF", // silver
    iconName: "ArrowLeftRight",
    isEssential: false,
  },
};

export const ALL_CATEGORIES = Object.keys(CATEGORIES) as CategoryName[];

export const ESSENTIAL_CATEGORIES: CategoryName[] = [
  "Rent & Housing",
  "Utilities",
  "Groceries",
  "Healthcare",
  "Transport",
];
