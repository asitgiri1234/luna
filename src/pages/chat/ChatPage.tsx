import { ExecutionCardStack } from "@/components/automation/ExecutionCardStack";
import { MemoryApprovalStack } from "@/components/memory/MemoryApprovalStack";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { useChatStore } from "@/store/chat/chat.store";

import { ChatComposer } from "./ChatComposer";
import { ChatEmptyState } from "./ChatEmptyState";

export function ChatPage() {
  const hasMessages = useChatStore((state) => state.messages.length > 0);

  return (
    <div className="flex h-full flex-col">
      {hasMessages ? <ChatMessageList /> : <ChatEmptyState />}
      <div className="relative">
        <ExecutionCardStack />
        <MemoryApprovalStack />
        <ChatComposer />
      </div>
    </div>
  );
}
