export type CategoryKind = "product" | "service";

type CategoryItem = { id: string; label: string };
type CategoryGroup = { id: string; label: string; items: CategoryItem[] };

const PRODUCT_GROUPS: CategoryGroup[] = [
  {
    id: "home-furniture",
    label: "Home & Furniture",
    items: [
      { id: "furniture", label: "Furniture" },
      { id: "home-decor", label: "Home Decor" },
      { id: "kitchen-dining", label: "Kitchen & Dining" },
      { id: "bedding-bath", label: "Bedding & Bath" },
      { id: "lighting", label: "Lighting" },
      { id: "storage-organization", label: "Storage & Organization" },
      { id: "appliances", label: "Appliances" },
      { id: "other-home-items", label: "Other Home Items" },
    ],
  },
  {
    id: "garden-outdoor",
    label: "Garden & Outdoor",
    items: [
      { id: "patio-furniture", label: "Patio Furniture" },
      { id: "planters-gardening", label: "Planters & Gardening" },
      { id: "lawn-garden-equipment", label: "Lawn & Garden Equipment" },
      { id: "bbq-outdoor-cooking", label: "BBQ & Outdoor Cooking" },
      { id: "outdoor-decor", label: "Outdoor Decor" },
      { id: "pools-hot-tubs", label: "Pools & Hot Tubs" },
      { id: "outdoor-structures", label: "Outdoor Structures" },
      { id: "other-garden-outdoor", label: "Other Garden & Outdoor" },
    ],
  },
  {
    id: "electronics",
    label: "Electronics",
    items: [
      { id: "phones-tablets", label: "Phones & Tablets" },
      { id: "computers-laptops", label: "Computers & Laptops" },
      { id: "tvs-displays", label: "TVs & Displays" },
      { id: "audio-speakers", label: "Audio & Speakers" },
      { id: "cameras-photography", label: "Cameras & Photography" },
      { id: "smart-home", label: "Smart Home" },
      { id: "wearables", label: "Wearables" },
      { id: "accessories", label: "Accessories" },
      { id: "other-electronics", label: "Other Electronics" },
    ],
  },
  {
    id: "clothing-accessories",
    label: "Clothing & Accessories",
    items: [
      { id: "mens-clothing", label: "Men's Clothing" },
      { id: "womens-clothing", label: "Women's Clothing" },
      { id: "kids-clothing", label: "Kids' Clothing" },
      { id: "shoes", label: "Shoes" },
      { id: "bags-luggage", label: "Bags & Luggage" },
      { id: "jewelry", label: "Jewelry" },
      { id: "watches", label: "Watches" },
      { id: "accessories", label: "Accessories" },
      { id: "other-clothing-accessories", label: "Other Clothing & Accessories" },
    ],
  },
  {
    id: "baby-kids",
    label: "Baby & Kids",
    items: [
      { id: "baby-gear", label: "Baby Gear" },
      { id: "strollers-carriers", label: "Strollers & Carriers" },
      { id: "nursery", label: "Nursery" },
      { id: "kids-furniture", label: "Kids Furniture" },
      { id: "baby-clothing", label: "Baby Clothing" },
      { id: "kids-clothing", label: "Kids Clothing" },
      { id: "toys", label: "Toys" },
      { id: "other-baby-kids", label: "Other Baby & Kids" },
    ],
  },
  {
    id: "sports-fitness",
    label: "Sports & Fitness",
    items: [
      { id: "fitness-equipment", label: "Fitness Equipment" },
      { id: "weights-gym-equipment", label: "Weights & Gym Equipment" },
      { id: "bikes-cycling", label: "Bikes & Cycling" },
      { id: "team-sports", label: "Team Sports" },
      { id: "golf", label: "Golf" },
      { id: "hockey", label: "Hockey" },
      { id: "basketball", label: "Basketball" },
      { id: "winter-sports", label: "Winter Sports" },
      { id: "water-sports", label: "Water Sports" },
      { id: "other-sports-fitness", label: "Other Sports & Fitness" },
    ],
  },
  {
    id: "tools-home-improvement",
    label: "Tools & Home Improvement",
    items: [
      { id: "power-tools", label: "Power Tools" },
      { id: "hand-tools", label: "Hand Tools" },
      { id: "building-materials", label: "Building Materials" },
      { id: "hardware", label: "Hardware" },
      { id: "electrical", label: "Electrical" },
      { id: "plumbing", label: "Plumbing" },
      { id: "painting-supplies", label: "Painting Supplies" },
      { id: "safety-equipment", label: "Safety Equipment" },
      { id: "other-tools-home-improvement", label: "Other Tools & Home Improvement" },
    ],
  },
  {
    id: "auto-vehicle",
    label: "Auto & Vehicle",
    items: [
      { id: "cars-trucks", label: "Cars & Trucks" },
      { id: "motorcycles", label: "Motorcycles" },
      { id: "atvs-snowmobiles", label: "ATVs & Snowmobiles" },
      { id: "trailers", label: "Trailers" },
      { id: "rvs-campers", label: "RVs & Campers" },
      { id: "boats", label: "Boats" },
      { id: "auto-parts", label: "Auto Parts" },
      { id: "wheels-tires", label: "Wheels & Tires" },
      { id: "vehicle-accessories", label: "Vehicle Accessories" },
      { id: "other-auto-vehicle", label: "Other Auto & Vehicle" },
    ],
  },
  {
    id: "hobbies-collectibles",
    label: "Hobbies & Collectibles",
    items: [
      { id: "collectibles", label: "Collectibles" },
      { id: "trading-cards", label: "Trading Cards" },
      { id: "models-figures", label: "Models & Figures" },
      { id: "arts-crafts", label: "Arts & Crafts" },
      { id: "musical-instruments", label: "Musical Instruments" },
      { id: "books", label: "Books" },
      { id: "movies-music", label: "Movies & Music" },
      { id: "antiques", label: "Antiques" },
      { id: "other-hobbies-collectibles", label: "Other Hobbies & Collectibles" },
    ],
  },
  {
    id: "gaming-entertainment",
    label: "Gaming & Entertainment",
    items: [
      { id: "video-games", label: "Video Games" },
      { id: "game-consoles", label: "Game Consoles" },
      { id: "gaming-accessories", label: "Gaming Accessories" },
      { id: "board-games", label: "Board Games" },
      { id: "toys-games", label: "Toys & Games" },
      { id: "entertainment-equipment", label: "Entertainment Equipment" },
      { id: "other-gaming-entertainment", label: "Other Gaming & Entertainment" },
    ],
  },
  {
    id: "beauty-personal-care",
    label: "Beauty & Personal Care",
    items: [
      { id: "beauty-products", label: "Beauty Products" },
      { id: "hair-care", label: "Hair Care" },
      { id: "skincare", label: "Skincare" },
      { id: "personal-care", label: "Personal Care" },
      { id: "beauty-tools", label: "Beauty Tools" },
      { id: "other-beauty-personal-care", label: "Other Beauty & Personal Care" },
    ],
  },
  {
    id: "pet-supplies",
    label: "Pet Supplies",
    items: [
      { id: "dog-supplies", label: "Dog Supplies" },
      { id: "cat-supplies", label: "Cat Supplies" },
      { id: "aquarium-supplies", label: "Aquarium Supplies" },
      { id: "bird-supplies", label: "Bird Supplies" },
      { id: "small-pet-supplies", label: "Small Pet Supplies" },
      { id: "pet-furniture", label: "Pet Furniture" },
      { id: "other-pet-supplies", label: "Other Pet Supplies" },
    ],
  },
  {
    id: "office-business",
    label: "Office & Business",
    items: [
      { id: "office-furniture", label: "Office Furniture" },
      { id: "office-supplies", label: "Office Supplies" },
      { id: "business-equipment", label: "Business Equipment" },
      { id: "pos-equipment", label: "POS Equipment" },
      { id: "commercial-equipment", label: "Commercial Equipment" },
      { id: "packaging-shipping-supplies", label: "Packaging & Shipping Supplies" },
      { id: "other-office-business", label: "Other Office & Business" },
    ],
  },
  {
    id: "handmade-custom",
    label: "Handmade & Custom",
    items: [
      { id: "custom-gifts", label: "Custom Gifts" },
      { id: "personalized-products", label: "Personalized Products" },
      { id: "handmade-crafts", label: "Handmade Crafts" },
      { id: "3d-printed-products", label: "3D Printed Products" },
      { id: "custom-clothing", label: "Custom Clothing" },
      { id: "custom-signs", label: "Custom Signs" },
      { id: "art-prints", label: "Art & Prints" },
      { id: "other-handmade-custom", label: "Other Handmade & Custom" },
    ],
  },
  {
    id: "other-products",
    label: "Other Products",
    items: [
      { id: "general-merchandise", label: "General Merchandise" },
      { id: "miscellaneous", label: "Miscellaneous" },
      { id: "other", label: "Other" },
    ],
  },
];

const SERVICE_GROUPS: CategoryGroup[] = [
  {
    id: "home-services",
    label: "Home Services",
    items: [
      { id: "house-cleaning", label: "House Cleaning" },
      { id: "handyman", label: "Handyman" },
      { id: "furniture-assembly", label: "Furniture Assembly" },
      { id: "appliance-installation", label: "Appliance Installation" },
      { id: "home-organization", label: "Home Organization" },
      { id: "junk-removal", label: "Junk Removal" },
      { id: "moving-help", label: "Moving Help" },
      { id: "pressure-washing", label: "Pressure Washing" },
      { id: "window-cleaning", label: "Window Cleaning" },
      { id: "other-home-services", label: "Other Home Services" },
    ],
  },
  {
    id: "construction-trades",
    label: "Construction & Trades",
    items: [
      { id: "general-contracting", label: "General Contracting" },
      { id: "carpentry", label: "Carpentry" },
      { id: "deck-fence", label: "Deck & Fence" },
      { id: "plumbing", label: "Plumbing" },
      { id: "electrical", label: "Electrical" },
      { id: "hvac", label: "HVAC" },
      { id: "roofing", label: "Roofing" },
      { id: "flooring", label: "Flooring" },
      { id: "painting", label: "Painting" },
      { id: "drywall", label: "Drywall" },
      { id: "concrete-masonry", label: "Concrete & Masonry" },
      { id: "welding-fabrication", label: "Welding & Fabrication" },
      { id: "renovation", label: "Renovation" },
      { id: "other-construction-trades", label: "Other Construction & Trades" },
    ],
  },
  {
    id: "lawn-outdoor-services",
    label: "Lawn & Outdoor Services",
    items: [
      { id: "lawn-care", label: "Lawn Care" },
      { id: "landscaping", label: "Landscaping" },
      { id: "gardening", label: "Gardening" },
      { id: "tree-services", label: "Tree Services" },
      { id: "snow-removal", label: "Snow Removal" },
      { id: "fence-installation", label: "Fence Installation" },
      { id: "deck-installation", label: "Deck Installation" },
      { id: "irrigation", label: "Irrigation" },
      { id: "outdoor-maintenance", label: "Outdoor Maintenance" },
      { id: "other-lawn-outdoor-services", label: "Other Lawn & Outdoor Services" },
    ],
  },
  {
    id: "automotive-services",
    label: "Automotive Services",
    items: [
      { id: "auto-repair", label: "Auto Repair" },
      { id: "mobile-mechanic", label: "Mobile Mechanic" },
      { id: "tire-service", label: "Tire Service" },
      { id: "car-detailing", label: "Car Detailing" },
      { id: "car-wash", label: "Car Wash" },
      { id: "towing", label: "Towing" },
      { id: "vehicle-inspection", label: "Vehicle Inspection" },
      { id: "auto-body-paint", label: "Auto Body & Paint" },
      { id: "other-automotive-services", label: "Other Automotive Services" },
    ],
  },
  {
    id: "beauty-wellness",
    label: "Beauty & Wellness",
    items: [
      { id: "hair", label: "Hair" },
      { id: "nails", label: "Nails" },
      { id: "makeup", label: "Makeup" },
      { id: "barber", label: "Barber" },
      { id: "massage", label: "Massage" },
      { id: "spa-services", label: "Spa Services" },
      { id: "personal-training", label: "Personal Training" },
      { id: "fitness-coaching", label: "Fitness Coaching" },
      { id: "other-beauty-wellness", label: "Other Beauty & Wellness" },
    ],
  },
  {
    id: "creative-services",
    label: "Creative Services",
    items: [
      { id: "photography", label: "Photography" },
      { id: "videography", label: "Videography" },
      { id: "graphic-design", label: "Graphic Design" },
      { id: "logo-design", label: "Logo Design" },
      { id: "illustration", label: "Illustration" },
      { id: "animation", label: "Animation" },
      { id: "music-audio", label: "Music & Audio" },
      { id: "printing", label: "Printing" },
      { id: "embroidery", label: "Embroidery" },
      { id: "custom-design", label: "Custom Design" },
      { id: "other-creative-services", label: "Other Creative Services" },
    ],
  },
  {
    id: "digital-tech-services",
    label: "Digital & Tech Services",
    items: [
      { id: "website-development", label: "Website Development" },
      { id: "app-development", label: "App Development" },
      { id: "software-development", label: "Software Development" },
      { id: "it-support", label: "IT Support" },
      { id: "computer-repair", label: "Computer Repair" },
      { id: "phone-repair", label: "Phone Repair" },
      { id: "data-automation", label: "Data & Automation" },
      { id: "ai-services", label: "AI Services" },
      { id: "cybersecurity", label: "Cybersecurity" },
      { id: "smart-home-setup", label: "Smart Home Setup" },
      { id: "other-digital-tech-services", label: "Other Digital & Tech Services" },
    ],
  },
  {
    id: "business-services",
    label: "Business Services",
    items: [
      { id: "accounting-bookkeeping", label: "Accounting & Bookkeeping" },
      { id: "tax-services", label: "Tax Services" },
      { id: "consulting", label: "Consulting" },
      { id: "marketing", label: "Marketing" },
      { id: "social-media", label: "Social Media" },
      { id: "advertising", label: "Advertising" },
      { id: "branding", label: "Branding" },
      { id: "virtual-assistant", label: "Virtual Assistant" },
      { id: "administrative-support", label: "Administrative Support" },
      { id: "translation", label: "Translation" },
      { id: "writing-editing", label: "Writing & Editing" },
      { id: "other-business-services", label: "Other Business Services" },
    ],
  },
  {
    id: "lessons-tutoring",
    label: "Lessons & Tutoring",
    items: [
      { id: "academic-tutoring", label: "Academic Tutoring" },
      { id: "language-lessons", label: "Language Lessons" },
      { id: "music-lessons", label: "Music Lessons" },
      { id: "art-lessons", label: "Art Lessons" },
      { id: "coding-lessons", label: "Coding Lessons" },
      { id: "sports-coaching", label: "Sports Coaching" },
      { id: "driving-lessons", label: "Driving Lessons" },
      { id: "career-coaching", label: "Career Coaching" },
      { id: "other-lessons-tutoring", label: "Other Lessons & Tutoring" },
    ],
  },
  {
    id: "events-entertainment",
    label: "Events & Entertainment",
    items: [
      { id: "event-planning", label: "Event Planning" },
      { id: "wedding-services", label: "Wedding Services" },
      { id: "dj", label: "DJ" },
      { id: "live-music", label: "Live Music" },
      { id: "photography", label: "Photography" },
      { id: "videography", label: "Videography" },
      { id: "catering", label: "Catering" },
      { id: "party-rentals", label: "Party Rentals" },
      { id: "decoration", label: "Decoration" },
      { id: "entertainment", label: "Entertainment" },
      { id: "other-event-services", label: "Other Event Services" },
    ],
  },
  {
    id: "pet-services",
    label: "Pet Services",
    items: [
      { id: "pet-sitting", label: "Pet Sitting" },
      { id: "dog-walking", label: "Dog Walking" },
      { id: "pet-grooming", label: "Pet Grooming" },
      { id: "pet-training", label: "Pet Training" },
      { id: "pet-transportation", label: "Pet Transportation" },
      { id: "other-pet-services", label: "Other Pet Services" },
    ],
  },
  {
    id: "moving-delivery",
    label: "Moving & Delivery",
    items: [
      { id: "moving", label: "Moving" },
      { id: "furniture-delivery", label: "Furniture Delivery" },
      { id: "local-delivery", label: "Local Delivery" },
      { id: "courier", label: "Courier" },
      { id: "hauling", label: "Hauling" },
      { id: "junk-removal", label: "Junk Removal" },
      { id: "pickup-drop-off", label: "Pickup & Drop-off" },
      { id: "other-moving-delivery", label: "Other Moving & Delivery" },
    ],
  },
  {
    id: "property-real-estate",
    label: "Property & Real Estate Services",
    items: [
      { id: "property-management", label: "Property Management" },
      { id: "real-estate-photography", label: "Real Estate Photography" },
      { id: "home-staging", label: "Home Staging" },
      { id: "property-maintenance", label: "Property Maintenance" },
      { id: "short-term-rental-management", label: "Short-Term Rental Management" },
      { id: "cleaning-turnover", label: "Cleaning & Turnover" },
      { id: "other-property-services", label: "Other Property Services" },
    ],
  },
  {
    id: "personal-services",
    label: "Personal Services",
    items: [
      { id: "personal-assistant", label: "Personal Assistant" },
      { id: "errands", label: "Errands" },
      { id: "senior-assistance", label: "Senior Assistance" },
      { id: "childcare", label: "Childcare" },
      { id: "personal-shopping", label: "Personal Shopping" },
      { id: "meal-preparation", label: "Meal Preparation" },
      { id: "other-personal-services", label: "Other Personal Services" },
    ],
  },
  {
    id: "repair-services",
    label: "Repair Services",
    items: [
      { id: "appliance-repair", label: "Appliance Repair" },
      { id: "electronics-repair", label: "Electronics Repair" },
      { id: "computer-repair", label: "Computer Repair" },
      { id: "phone-repair", label: "Phone Repair" },
      { id: "furniture-repair", label: "Furniture Repair" },
      { id: "bicycle-repair", label: "Bicycle Repair" },
      { id: "small-engine-repair", label: "Small Engine Repair" },
      { id: "other-repair-services", label: "Other Repair Services" },
    ],
  },
  {
    id: "travel-transportation",
    label: "Travel & Transportation",
    items: [
      { id: "transportation", label: "Transportation" },
      { id: "airport-transfer", label: "Airport Transfer" },
      { id: "local-driver", label: "Local Driver" },
      { id: "tour-guide", label: "Tour Guide" },
      { id: "travel-planning", label: "Travel Planning" },
      { id: "other-travel-transportation", label: "Other Travel & Transportation" },
    ],
  },
  {
    id: "other-services",
    label: "Other Services",
    items: [
      { id: "general-services", label: "General Services" },
      { id: "other", label: "Other" },
    ],
  },
];

function assertTree(kind: CategoryKind, groups: CategoryGroup[]) {
  const categories = new Set<string>();
  for (const group of groups) {
    if (categories.has(group.id)) throw new Error(`Duplicate ${kind} category slug: ${group.id}`);
    categories.add(group.id);
    const items = new Set<string>();
    for (const item of group.items) {
      if (items.has(item.id)) throw new Error(`Duplicate ${kind} subcategory slug: ${group.id}/${item.id}`);
      items.add(item.id);
    }
  }
}

assertTree("product", PRODUCT_GROUPS);
assertTree("service", SERVICE_GROUPS);

export const listingTypes: { id: CategoryKind; label: string }[] = [
  { id: "product", label: "Product" },
  { id: "service", label: "Service" },
];

export const DIGITAL_FILE_CATEGORY = {
  kind: "product" as const,
  groupId: "digital-file",
  itemId: "digital-file",
  label: "Digital file",
};

export function groupsFor(kind: CategoryKind) {
  return kind === "service" ? SERVICE_GROUPS : PRODUCT_GROUPS;
}

export function isCategoryKind(value: string): value is CategoryKind {
  return value === "product" || value === "service";
}

export type ResolvedCategory = {
  kind: CategoryKind;
  groupId: string;
  itemId: string;
  groupLabel: string;
  itemLabel: string;
};

export function resolveCategory(kind: string, groupId: string, itemId: string, allowService: boolean): ResolvedCategory | null {
  if (kind !== "product" && !(allowService && kind === "service")) return null;
  if (!isCategoryKind(kind)) return null;
  const group = groupsFor(kind).find((row) => row.id === groupId);
  if (!group) return null;
  if (!itemId) return { kind, groupId: group.id, itemId: "", groupLabel: group.label, itemLabel: "" };
  const item = group.items.find((row) => row.id === itemId);
  if (!item) return null;
  return { kind, groupId: group.id, itemId: item.id, groupLabel: group.label, itemLabel: item.label };
}

export function categoryLabel(kind: string, groupId: string, itemId: string) {
  if (kind === DIGITAL_FILE_CATEGORY.kind && groupId === DIGITAL_FILE_CATEGORY.groupId && itemId === DIGITAL_FILE_CATEGORY.itemId) {
    return DIGITAL_FILE_CATEGORY.label;
  }
  const found = resolveCategory(kind, groupId, itemId, true);
  if (!found) return "";
  const prefix = found.kind === "service" ? "Service" : "Product";
  if (!found.itemLabel) return `${prefix} · ${found.groupLabel}`;
  return `${prefix} · ${found.groupLabel} · ${found.itemLabel}`;
}

export function categoryProblem(kind: string, groupId: string, itemId: string, allowService: boolean) {
  if (resolveCategory(kind, groupId, itemId, allowService)) return null;
  const safeKind: CategoryKind | "" = kind === "service" && allowService ? "service" : kind === "product" ? "product" : "";
  if (!safeKind) return allowService ? "Choose a product or service." : "Choose a category.";
  const group = groupsFor(safeKind).find((row) => row.id === groupId);
  if (!group) return "Choose a category.";
  return "Choose a subcategory.";
}

export function categoryHref(kind: string, groupId = "", itemId = "") {
  if (!isCategoryKind(kind)) return "/c";
  if (!groupId) return `/c/${kind}`;
  if (!itemId) return `/c/${kind}/${groupId}`;
  return `/c/${kind}/${groupId}/${itemId}`;
}

export function parseCategoryPath(segments: string[] | undefined) {
  const slug = segments ?? [];
  if (slug.length === 0) return { kind: "", groupId: "", itemId: "" };
  if (slug.length > 3) return null;
  const [kind = "", groupId = "", itemId = ""] = slug;
  if (!isCategoryKind(kind)) return null;
  if (!groupId) return itemId ? null : { kind, groupId: "", itemId: "" };
  const found = resolveCategory(kind, groupId, itemId, true);
  if (!found) return null;
  return { kind: found.kind, groupId: found.groupId, itemId: found.itemId };
}

export function matchesListing(
  item: { categoryKind: string; categoryGroup: string; category: string; title?: string; description?: string },
  filter: { kind?: string; category?: string; subcategory?: string; query?: string },
) {
  if (filter.kind && item.categoryKind !== filter.kind) return false;
  if (filter.category && item.categoryGroup !== filter.category) return false;
  if (filter.subcategory && item.category !== filter.subcategory) return false;
  const query = filter.query?.trim().toLowerCase();
  if (!query) return true;
  return `${item.title ?? ""} ${item.description ?? ""}`.toLowerCase().includes(query);
}
