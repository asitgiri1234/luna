import { useEffect, useState } from "react";

import { ImageOff } from "lucide-react";

import type { MessageImageContext } from "@/ai/documents/image-chat.types";
import { fileService } from "@/files/file.service";

/**
 * Shows the image an assistant reply is about, above the response, plus a
 * "No analysis available" note when the image hasn't been analyzed yet.
 */
export function MessageImage({ imageChat }: { imageChat: MessageImageContext }) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fileService.preview(imageChat.imageId).then((url) => {
      if (active) setPreview(url);
    });
    return () => {
      active = false;
    };
  }, [imageChat.imageId]);

  return (
    <div className="mb-2">
      <div className="inline-flex flex-col overflow-hidden rounded-xl border border-border/60 bg-secondary/30">
        {preview ? (
          <img
            src={preview}
            alt={imageChat.filename}
            className="max-h-56 max-w-full object-contain"
          />
        ) : (
          <div className="flex h-24 w-40 items-center justify-center text-muted-foreground">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
        <span className="truncate px-2 py-1 text-[11px] text-muted-foreground" title={imageChat.filename}>
          {imageChat.filename}
        </span>
      </div>
      {!imageChat.hasAnalysis && (
        <p className="mt-1 text-xs text-amber-400/90">
          No analysis available — analyze this image first for grounded answers.
        </p>
      )}
    </div>
  );
}
