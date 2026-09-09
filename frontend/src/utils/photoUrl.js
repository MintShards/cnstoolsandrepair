// Customer repair photos are private in cloud storage — the admin UI views
// them through the staff-guarded redirect endpoint, which 302s each request
// to a fresh short-lived presigned URL (or to /uploads in dev). Relative on
// purpose: same-origin keeps the auth cookie on <img> requests, via the
// Vite proxy in dev and nginx in prod. Public assets (gallery, products,
// brand logos) do NOT go through here.
export const customerPhotoUrl = (photo) =>
  `/api/photos/view?src=${encodeURIComponent(photo)}`;
