# Adding products and categories

The catalog is data. A new Apple product is added in the admin panel and reaches
customers from Supabase — no code change, no app store release.

```
Admin → Products → + Add Product
            ↓
        Supabase           products, product_variants, product_specs,
            ↓              product_images, product_compatibility, product_prices
   Customer storefront     next time the catalog loads
```

## Adding a product

**Admin → Products → + Add Product.** Owner and admin may create; staff is
read-only, enforced by the database rather than by the screen.

| Section | Notes |
|---|---|
| Basics | Name, and the **product ID** (slug) suggested from it. The ID is permanent: it is the product's address and the key saved carts use. Category comes from the categories table; subcategory is the fixed list the database allows. |
| Variants | Storage, colour or size options. Each gets its own retail and wholesale VIP price. Leave empty for something sold as one thing and price it in the Pricing section instead. |
| Pricing | Whole rupees. Written through `admin_set_price()` — the same audited function the Pricing screen uses, with full history. |
| Specifications | Label and value, shown on the product page in this order. |
| Images | A path into the app's bundled image library (`/images/products/…`) or a full `https://` URL. The first image is the card image. |
| Compatibility | For parts and accessories. Pick a known device model or type free text. |
| Publish | Ticked by default, but held back automatically if anything is missing. |

### Two rules the screen enforces

1. **A product is written unpublished first.** It only goes live once every row —
   variants, specs, images, compatibility and prices — has saved. If any part
   fails, the draft is removed and the error is shown. A customer can never meet
   a half-created product.
2. **No retail price, no customers.** A published product with no retail price is
   listed in the admin panel as *“No price — not shown”* and is withheld from the
   storefront. This is the existing house rule: the storefront never invents a
   number, and Rs. 0 is not a price.

### Images

This Supabase project has **no Storage bucket**, so nothing is uploaded here —
image rows hold a path or a URL, exactly as they always have. Either:

- add the file to `public/images/products/…` and ship it with the next app
  update, then reference that path; or
- host the image and paste the full `https://` URL, which works immediately on
  phones that already have the app.

## Categories

**Admin → Categories.** Create, edit, hide and show. Subcategories are supported
by the existing `parent_id` column.

Products added to one of the seven existing customer categories — iPhone, iPad,
Mac, Apple Watch, AirPods, Replacement Parts, Accessories — appear in the store
immediately.

A **brand-new category** groups and labels products straight away, and those
products are reachable by search and by their own page. Its own
`/categories/<slug>` browse page is part of the app build, so that page arrives
with the next app update. The admin screen says so where it matters.

## Editing and deleting

Everything on an existing product is editable, including adding and removing
variants, images and compatibility entries. Removals ask for confirmation first
and are written immediately; text edits are batched under **Save changes**.

Deletion is deliberately narrow. A product that has ever appeared on an order
**cannot** be deleted — the editor says how many order lines reference it and
offers unpublishing instead, which hides it from customers and leaves every
order intact. Only a product that has never been ordered can be removed.

## Why new products use a different link

The app is a static export inside an APK, so every page has to exist as a file
when the app is built. Products that shipped with the build keep their
`/product/<id>` page. Anything created afterwards is served by `/p?id=<id>`, one
page that resolves any product at runtime. `productHref()` picks the right one,
so nothing in the UI has to know the difference.
