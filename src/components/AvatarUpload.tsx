"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { setProfilePhoto } from "@/app/actions/profile";
import Avatar from "./Avatar";
import { buttonClass } from "./ui";

/** Crops the picture to a centred square and shrinks it to 512 px JPEG. */
async function squareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const out = 512;
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85),
  );
}

export default function AvatarUpload({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const t = useTranslations("Photo");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    setError(false);
    try {
      const blob = await squareJpeg(file);
      const supabase = createClient();
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const res = await setProfilePhoto(data.publicUrl);
      if (res.error) throw new Error(res.error);
      // Remove the previous photo file.
      const old = url?.split("/avatars/")[1];
      if (old) await supabase.storage.from("avatars").remove([decodeURIComponent(old)]);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const old = url?.split("/avatars/")[1];
      await setProfilePhoto("");
      if (old) await createClient().storage.from("avatars").remove([decodeURIComponent(old)]);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <label htmlFor="avatar-file" className="relative cursor-pointer" aria-label={t("change")}>
        <Avatar name={name} url={url} size={72} />
        <span className="absolute -bottom-1 -end-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-surface">
          <Camera className="h-4 w-4" aria-hidden />
        </span>
      </label>
      <input
        ref={input}
        id="avatar-file"
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <div className="flex flex-col items-start gap-1">
        <label htmlFor="avatar-file" className={`${buttonClass.secondary} min-h-9 cursor-pointer px-3 py-1.5 text-sm ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? t("uploading") : url ? t("change") : t("add")}
        </label>
        {url && !busy ? (
          <button type="button" onClick={remove} className="text-xs font-semibold text-ink-muted underline">
            {t("remove")}
          </button>
        ) : null}
        {error ? <span className="text-xs text-red-700">{t("failed")}</span> : null}
        {!url ? <span className="text-xs text-ink-muted">{t("hint")}</span> : null}
      </div>
    </div>
  );
}
