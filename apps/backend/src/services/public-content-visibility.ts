import { accountSessionPolicy } from "./account-session-policy.js";
import { authAdmin } from "./firebase-auth-service.js";

export type PublicContentVisibility = (uid: string) => Promise<boolean>;

export class PublicVisibilityUnavailableError extends Error {
  constructor(cause: unknown) {
    super("Public content visibility could not be verified.", {cause});
    this.name = "PublicVisibilityUnavailableError";
  }
}

export const publicContentVisibility: PublicContentVisibility = async (uid) => {
  try {
    authAdmin();
    return await accountSessionPolicy.isPublicContentVisible(uid);
  } catch (error) {
    throw new PublicVisibilityUnavailableError(error);
  }
};

export async function visibleItems<T>(
  items: T[],
  owner: (item: T) => string,
  visible: PublicContentVisibility,
): Promise<T[]> {
  const owners = [...new Set(items.map(owner))];
  const checks = await Promise.all(owners.map(async uid => [uid, await visible(uid)] as const));
  const visibility = new Map(checks);
  return items.filter(item => visibility.get(owner(item)) === true);
}
