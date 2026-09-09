export function formatPrice(price: number): string {
  // Use toLocaleString to get thousands separators (e.g., 359,000)
  return `Rs. ${price.toLocaleString('en-US')}`;
}
