import { Platform } from "react-native";
import Purchases, {
  PRODUCT_CATEGORY,
  type PurchasesError,
  type PurchasesStoreProduct,
} from "react-native-purchases";

export const APPLE_CREDIT_PRODUCT_IDS = [
  "isfaham_1_hour",
  "isfaham_5_hours",
  "isfaham_10_hours",
] as const;

let configuredUserId: string | null = null;

async function ensureRevenueCat(userId: string) {
  if (Platform.OS !== "ios") {
    throw new Error("Apple purchases are available only on iPhone and iPad.");
  }

  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  if (!apiKey) {
    throw new Error("Apple purchases are not configured yet.");
  }

  if (!configuredUserId) {
    Purchases.configure({ apiKey, appUserID: userId });
    configuredUserId = userId;
  } else if (configuredUserId !== userId) {
    await Purchases.logIn(userId);
    configuredUserId = userId;
  }
}

export async function getAppleCreditProducts(userId: string) {
  await ensureRevenueCat(userId);
  return Purchases.getProducts(
    [...APPLE_CREDIT_PRODUCT_IDS],
    PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  );
}

export async function purchaseAppleCredits(
  userId: string,
  product: PurchasesStoreProduct,
) {
  await ensureRevenueCat(userId);
  return Purchases.purchaseStoreProduct(product);
}

export function isCancelledPurchase(error: unknown) {
  const purchaseError = error as Partial<PurchasesError>;
  return (
    purchaseError.code ===
      Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ||
    purchaseError.userCancelled === true
  );
}

export async function logOutApplePurchases() {
  if (!configuredUserId) return;
  await Purchases.logOut();
  configuredUserId = null;
}

export type AppleCreditProduct = PurchasesStoreProduct;
