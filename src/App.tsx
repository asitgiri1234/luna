import { RouterProvider } from "react-router-dom";

import { router } from "./router";

/**
 * App stays intentionally thin: it only mounts top-level providers.
 * Routing lives in `router.tsx`, chrome in `layouts/`, screens in `pages/`.
 */
export default function App() {
  return <RouterProvider router={router} />;
}
