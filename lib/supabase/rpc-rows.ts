/**
 * Row shapes returned by household-scoped RPCs that multiple pages consume.
 * Keep this file thin — only add a type when 2+ call sites need the same shape.
 */

export type CategoryRow = { id: string; name: string };
export type MemberRow = {
  id: string;
  display_name: string;
  role: "adult" | "kid";
};
export type MerchantRow = { name: string };
