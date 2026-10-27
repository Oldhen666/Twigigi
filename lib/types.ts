export type Cta = "buy" | "quote" | "contact";
export type ProductStatus = "draft" | "published" | "deactivated";
export type Fulfillment = "pickup" | "delivery" | "shipping";
export type OrderStatus = "unpaid" | "paid" | "fulfilled" | "canceled";
export type PaymentStatus = "unpaid" | "paid";
export type ProtectionStatus = "pending" | "active";
export type PayoutStatus = "none" | "held" | "processing" | "paid";
export type UserRole = "user" | "admin";

export const PROTECTION_DAYS = 21;

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  saved?: boolean;
  productId?: string;
  slug?: string;
  images?: string[];
  savedAt?: number;
  signedIn?: boolean;
  displayName?: string;
  next?: string;
};

export type User = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
};

export type ProductOption = {
  name: string;
  values: string[];
};

export type ProductVariant = {
  key: string;
  priceCents: number;
  available: boolean;
  sku: string;
};

export type QuoteFormItem = {
  id: string;
  description: string;
};

export type QuoteFormQuestion = {
  id: string;
  label: string;
  required: boolean;
};

export type QuoteForm = {
  askName: boolean;
  askPhone: boolean;
  askCompany: boolean;
  askAddress: boolean;
  askQuantity: boolean;
  items: QuoteFormItem[];
  questions: QuoteFormQuestion[];
  terms: string;
};

export type ProductInput = {
  slug: string;
  title: string;
  brand: string;
  description: string;
  priceCents: number | null;
  location: string;
  videoUrl: string | null;
  pickupEnabled: boolean;
  pickupNote: string;
  pickupTime: string;
  deliveryEnabled: boolean;
  deliveryRadiusKm: number | null;
  deliveryFeeCents: number | null;
  shippingEnabled: boolean;
  shippingFeeCents: number | null;
  shippingNote: string;
  onsiteEnabled: boolean;
  remoteEnabled: boolean;
  atLocationEnabled: boolean;
  cta: Cta;
  contactEmail: string;
  contactPhone: string;
  status: ProductStatus;
  images: string[];
  quantityAvailable: number | null;
  buttonLabel: string;
  hasOptions: boolean;
  samePrice: boolean;
  options: ProductOption[];
  variants: ProductVariant[];
  requireName: boolean;
  requireEmail: boolean;
  requirePhone: boolean;
  quoteForm: QuoteForm | null;
  paymentMethods: string[];
  cardPaymentUrl: string;
  interacEmail: string;
  venmoUsername: string;
  zelleMode: "phone" | "email";
  zelleContact: string;
  sellerContactMode: "phone" | "email";
  sellerContact: string;
};

export type Product = ProductInput & {
  id: string;
  userId: string;
  currency: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  deactivatesAt: string | null;
  deactivatedAt: string | null;
};

export type PublicProduct = Product & {
  username: string;
  displayName: string;
};

export type PublicSeller = {
  username: string;
  displayName: string;
  products: PublicProduct[];
};

export type OrderRecord = {
  id: string;
  publicRef: string;
  productId: string;
  sellerId: string;
  buyerId: string | null;
  productSlug: string;
  productTitle: string;
  username: string;
  displayName: string;
  buyerName: string;
  email: string;
  phone: string;
  quantity: number;
  fulfillment: Fulfillment;
  address: string;
  amountCents: number;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
  variantLabel: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider: string;
  providerPaymentId: string;
  paidAt: string | null;
  protectionStatus: ProtectionStatus;
  protectionStartedAt: string | null;
  protectionDays: number;
  payoutEligibleAt: string | null;
  payoutStatus: PayoutStatus;
  payoutAmountCents: number;
  providerTransferId: string;
  payoutCreatedAt: string | null;
  payoutCompletedAt: string | null;
  refundStatus: string;
  disputeStatus: string;
  stripeSessionId: string | null;
  src: string;
  createdAt: string;
};

export type QuoteRecord = {
  id: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  quantity: number;
  projectDetails: string;
  documents: { path: string; name: string }[];
  status: "new" | "contacted" | "closed";
  src: string;
  createdAt: string;
};

export type MessageRecord = {
  id: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  status: "new" | "read" | "closed";
  src: string;
  createdAt: string;
};

export type SellerStats = {
  views: number;
  orders: number;
  revenueCents: number;
  quotes: number;
  messages: number;
  sources: { src: string; count: number }[];
};
