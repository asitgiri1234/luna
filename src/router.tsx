import { Navigate, createHashRouter } from "react-router-dom";

import { AppLayout } from "@/layouts/AppLayout";
import { ChatPage } from "@/pages/chat/ChatPage";
import { FilesPage } from "@/pages/files/FilesPage";
import { HistoryPage } from "@/pages/history/HistoryPage";
import { MemoryPage } from "@/pages/memory/MemoryPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";

/**
 * Hash-based routing so the exact same bundle works from the Vite dev
 * server and from `file://` in the packaged app.
 */
export const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/chat" replace /> },
      { path: "/chat", element: <ChatPage /> },
      { path: "/chats", element: <HistoryPage /> },
      { path: "/files", element: <FilesPage /> },
      { path: "/memory", element: <MemoryPage /> },
      { path: "/settings", element: <SettingsPage /> },
      { path: "*", element: <Navigate to="/chat" replace /> },
    ],
  },
]);
