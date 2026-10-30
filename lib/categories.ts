export type CategoryKind = "product" | "service";

type CategoryItem = { id: string; label: string };
type CategoryGroup = { id: string; label: string; items: CategoryItem[] };

const PRODUCT_GROUPS: CategoryGroup[] = [
  {
    id: "home-garden",
    label: "Home & garden",
    items: [
      { id: "furniture", label: "Furniture" },
      { id: "planters", label: "Planters & pots" },
      { id: "decor", label: "Decor" },
      { id: "kitchen", label: "Kitchen" },
      { id: "outdoor", label: "Outdoor" },
      { id: "tools", label: "Tools" },
    ],
  },
  {
    id: "clothing",
    label: "Clothing & accessories",
    items: [
      { id: "clothing", label: "Clothing" },
      { id: "shoes", label: "Shoes" },
      { id: "jewelry", label: "Jewelry & accessories" },
    ],
  },
  {
    id: "food",
    label: "Food & drink",
    items: [
      { id: "baked", label: "Baked goods" },
      { id: "prepared", label: "Prepared food" },
      { id: "produce", label: "Produce" },
      { id: "drinks", label: "Drinks" },
    ],
  },
  {
    id: "art",
    label: "Art & crafts",
    items: [
      { id: "art", label: "Art" },
      { id: "handmade", label: "Handmade goods" },
      { id: "collectibles", label: "Collectibles" },
    ],
  },
  {
    id: "electronics",
    label: "Electronics",
    items: [
      { id: "phones", label: "Phones & computers" },
      { id: "audio", label: "Audio & cameras" },
      { id: "other-electronics", label: "Other electronics" },
    ],
  },
  {
    id: "kids",
    label: "Baby & kids",
    items: [
      { id: "toys", label: "Toys" },
      { id: "gear", label: "Baby gear" },
      { id: "kids-clothing", label: "Kids' clothing" },
    ],
  },
  {
    id: "sports",
    label: "Sports & outdoors",
    items: [
      { id: "sports-gear", label: "Sports gear" },
      { id: "bikes", label: "Bikes" },
      { id: "camping", label: "Camping" },
    ],
  },
  {
    id: "pets",
    label: "Pets",
    items: [
      { id: "pet-supplies", label: "Pet supplies" },
      { id: "pet-food", label: "Pet food" },
    ],
  },
  {
    id: "beauty",
    label: "Health & beauty",
    items: [
      { id: "beauty", label: "Beauty" },
      { id: "personal-care", label: "Personal care" },
    ],
  },
  {
    id: "other",
    label: "Other",
    items: [{ id: "other", label: "Other products" }],
  },
];

const SERVICE_GROUPS: CategoryGroup[] = [
  {
    id: "home",
    label: "Home services",
    items: [
      { id: "cleaning", label: "Cleaning" },
      { id: "repairs", label: "Repairs" },
      { id: "landscaping", label: "Landscaping" },
      { id: "moving", label: "Moving" },
    ],
  },
  {
    id: "lessons",
    label: "Lessons",
    items: [
      { id: "tutoring", label: "Tutoring" },
      { id: "music", label: "Music" },
      { id: "sports", label: "Sports" },
      { id: "language", label: "Language" },
    ],
  },
  {
    id: "events",
    label: "Events",
    items: [
      { id: "photography", label: "Photography" },
      { id: "catering", label: "Catering" },
      { id: "planning", label: "Planning" },
      { id: "entertainment", label: "Entertainment" },
    ],
  },
  {
    id: "wellness",
    label: "Beauty & wellness",
    items: [
      { id: "hair", label: "Hair & beauty" },
      { id: "fitness", label: "Fitness" },
      { id: "wellness", label: "Wellness" },
    ],
  },
  {
    id: "professional",
    label: "Professional",
    items: [
      { id: "design", label: "Design" },
      { id: "writing", label: "Writing" },
      { id: "consulting", label: "Consulting" },
    ],
  },
  {
    id: "auto",
    label: "Auto",
    items: [
      { id: "repair", label: "Repair" },
      { id: "detailing", label: "Detailing" },
    ],
  },
  {
    id: "pet-services",
    label: "Pet services",
    items: [
      { id: "grooming", label: "Grooming" },
      { id: "sitting", label: "Pet sitting" },
      { id: "training", label: "Training" },
    ],
  },
  {
    id: "tech",
    label: "Tech",
    items: [
      { id: "device-repair", label: "Device repair" },
      { id: "support", label: "Setup & support" },
    ],
  },
  {
    id: "other",
    label: "Other",
    items: [{ id: "other", label: "Other services" }],
  },
];

export function groupsFor(kind: CategoryKind) {
  return kind === "service" ? SERVICE_GROUPS : PRODUCT_GROUPS;
}

export function resolveCategory(kind: string, groupId: string, itemId: string, allowService: boolean) {
  if (kind !== "product" && !(allowService && kind === "service")) return null;
  const group = groupsFor(kind).find((row) => row.id === groupId);
  const item = group?.items.find((row) => row.id === itemId);
  if (!group || !item) return null;
  return { kind, groupId: group.id, itemId: item.id, groupLabel: group.label, itemLabel: item.label };
}

export function categoryLabel(kind: string, groupId: string, itemId: string) {
  const found = resolveCategory(kind, groupId, itemId, true);
  if (!found) return "";
  const prefix = found.kind === "service" ? "Service" : "Product";
  return `${prefix} · ${found.groupLabel} · ${found.itemLabel}`;
}

export function categoryProblem(kind: string, groupId: string, itemId: string, allowService: boolean) {
  if (resolveCategory(kind, groupId, itemId, allowService)) return null;
  const safeKind: CategoryKind | "" = kind === "service" && allowService ? "service" : kind === "product" ? "product" : "";
  const group = safeKind ? groupsFor(safeKind).find((row) => row.id === groupId) : undefined;
  if (!group) return "Choose a category.";
  return "Choose a subcategory.";
}
