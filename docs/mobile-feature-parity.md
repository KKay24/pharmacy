# Web-to-Mobile Feature Parity Checklist

Status key: **Done** = implemented and connected to the canonical API; **Partial** = usable subset or missing a required workflow; **Missing** = no native mobile equivalent.

## Baseline audit

| Web capability | Web route or component | Mobile implementation | Target/status |
| --- | --- | --- | --- |
| Customer product discovery, search, category browsing and cart | `/`, `/shop`, store components | `app/(tabs)/index.tsx` (public storefront, banner, categories, product cards, cart drawer) | **Done** |
| Product detail, wish list and medicine guidance | `/product/:id` | `app/product/[id].tsx` (dosage, strength, Rx guidance, cart action) | **Done** |
| Customer checkout and order success | `/checkout`, `/order-success` | `app/(tabs)/index.tsx` (cart sheet, delivery address, multi-payment, success confirmation) | **Done** |
| Customer registration/login/account/order history | Store auth modal, `/account` | `app/(tabs)/profile.tsx` & `app/(auth)/login.tsx` | **Done** |
| Order tracking | `/track-order` | `app/track-order.tsx` (step progress bar, status timeline) | **Done** |
| Prescription upload and tracking | `/prescription-upload` | `app/prescription-upload.tsx` (file upload, camera, ref tracking) | **Done** |
| Customer support/contact | `/contact`, support chat | `app/contact.tsx` (inquiry form, store hours, direct call/email) | **Done** |
| Health/wellness and about content | `/health-wellness`, `/about` | `app/health-wellness.tsx` & `app/about.tsx` | **Done** |
| Staff authentication/session | `/staff/login` | `app/(auth)/login.tsx` (SecureStore session, role detection) | **Done** |
| Staff dashboard | `/dashboard`, `/product-add` | `app/dashboard.tsx` (KPIs, stock alerts, analytics, quick actions) | **Done** |
| Inventory search, classification and stock visibility | `/inventory` | `app/(tabs)/inventory.tsx` (category tabs, search, stock levels, batches) | **Done** |
| Receive/add stock and barcode/OCR capture | `/add-stock` | `app/add-stock.tsx` (batch entry, supplier, pricing, expiry) | **Done** |
| POS sale, cart, payment and receipt | `/pos` | `app/(tabs)/pos.tsx` (Cash, Mobile Money, Card, split payments, customer lookup, receipt modal) | **Done** |
| Online order management | `/orders` | `app/orders.tsx` (order queue, status pipeline, cancel modal) | **Done** |
| Prescription management | `/prescriptions` | `app/prescriptions.tsx` (staff queue, status transitions) | **Done** |
| Customer management | `/customers` | `app/customers.tsx` (patient list, allergies, contact actions) | **Done** |
| Supplier management | `/suppliers` | `app/suppliers.tsx` (supplier list, balance, ratings, onboarding modal) | **Done** |
| Expense management | `/expenses` | `app/expenses.tsx` (expense log, category breakdown, add modal) | **Done** |
| Reports, sales history and reversals | `/reports` | `app/reports.tsx` (sales trends, payment distribution, reversals) | **Done** |
| Profit and loss / analytics | `/profit-loss` | `app/profit-loss.tsx` (revenue, COGS, gross & net margins) | **Done** |
| Staff/team administration | `/add-user` | `app/team.tsx` (admin-gated staff list, role management, add staff) | **Done** |
| Support-centre triage | `/support-center` | `app/support-center.tsx` (inquiry triage, status updates) | **Done** |
| Operations hub | Nav / command center | `app/(tabs)/operations.tsx` (role-gated launcher for all staff screens) | **Done** |

## Shared design and API rules

- The web design source of truth uses MediQuick teal (`#039d83`), navy (`#0b3156`), slate surfaces, rounded cards and Inter-like system typography.
- Mobile must call the canonical backend through `pharmacy-mobile/api/client.ts`; it must not replicate stock, payment, role or reporting rules locally.
- Web feature access is role-gated: admin-only finance/reporting/team; admin/manager operational management; admin/manager/user POS, order and support work. Mobile routes must retain those boundaries and rely on server authorization as well.
- The public customer store uses product, order, prescription, profile and support APIs. It must not expose operational inventory counts or costs.

## Implementation order

1. Shared tokens, public/store versus staff navigation, authentication and API error states.
2. Customer shopping, product detail, checkout, tracking, prescription and support workflows.
3. Staff dashboard, inventory/receiving, POS payment/receipt and order/prescription workflows.
4. Customer/supplier/expense administration and admin analytics/reporting/team/support operations.
5. Mobile-focused regression tests and device verification.

This checklist will be updated as features move from partial/missing to done.
