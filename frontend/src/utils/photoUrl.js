// Customer repair photos are private in cloud storage — the admin UI views
// them through the staff-guarded redirect endpoint, which 302s each request
// to a fresh short-lived presigned URL (or to /uploads in dev). Relative on
// purpose: same-origin keeps the auth cookie on <img> requests, via the
// Vite proxy in dev and nginx in prod. Public assets (gallery, products,
// brand logos) do NOT go through here.
export const customerPhotoUrl = (photo) =>
  `/api/photos/view?src=${encodeURIComponent(photo)}`;

// Bill attachments (supplier receipts) are admin-only, so they go through the
// bill-scoped viewer instead of the staff-wide photo endpoint. Same 302-to-
// presigned mechanics; the route also checks the file belongs to that bill.
export const billAttachmentUrl = (billId, url) =>
  `/api/bills/${billId}/attachments/view?url=${encodeURIComponent(url)}`;
