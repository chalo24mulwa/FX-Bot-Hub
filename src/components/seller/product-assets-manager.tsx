"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  uploadAndAttachScreenshot,
  uploadAndAttachDocumentationFile,
  uploadAndAttachProductFile,
} from "@/features/seller/upload-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPublicUrl } from "@/lib/storage/public-url";

interface Screenshot {
  id: string;
  storageKey: string;
  caption: string | null;
}
interface Documentation {
  id: string;
  title: string;
}
interface ProductFile {
  id: string;
  fileName: string;
  platform: string;
  fileSizeBytes: number;
}
interface ProductVersion {
  id: string;
  version: string;
  files: ProductFile[];
}

export function ProductAssetsManager({
  productId,
  screenshots,
  documentation,
  versions,
}: {
  productId: string;
  screenshots: Screenshot[];
  documentation: Documentation[];
  versions: ProductVersion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const screenshotInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const docTitleInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const versionInput = useRef<HTMLInputElement>(null);
  const changelogInput = useRef<HTMLTextAreaElement>(null);
  const [filePlatform, setFilePlatform] = useState<"MT4" | "MT5" | "MULTI_PLATFORM">("MT4");

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      }
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-8">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section>
        <h3 className="text-sm font-semibold text-slate-900">Screenshots</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {screenshots.map((s) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={s.id}
              src={getPublicUrl(s.storageKey)}
              alt={s.caption ?? ""}
              className="h-20 w-32 rounded border border-slate-200 object-cover"
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input ref={screenshotInput} type="file" accept="image/*" className="text-sm" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => {
              const file = screenshotInput.current?.files?.[0];
              if (!file) return;
              run(() => uploadAndAttachScreenshot(productId, file));
            }}
          >
            Upload screenshot
          </Button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900">Documentation</h3>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {documentation.map((d) => (
            <li key={d.id}>{d.title}</li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input ref={docTitleInput} placeholder="Document title" className="w-48" />
          <input ref={docInput} type="file" accept=".pdf,.md,.txt" className="text-sm" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => {
              const file = docInput.current?.files?.[0];
              const title = docTitleInput.current?.value.trim();
              if (!file || !title) {
                setError("Provide a title and a file.");
                return;
              }
              run(() => uploadAndAttachDocumentationFile(productId, file, title));
            }}
          >
            Upload document
          </Button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-900">Product files</h3>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {versions.map((v) => (
            <li key={v.id}>
              <span className="font-medium">v{v.version}</span>{" "}
              {v.files.map((f) => `${f.fileName} (${f.platform}, ${(f.fileSizeBytes / 1024).toFixed(0)} KB)`).join(", ")}
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Input ref={versionInput} placeholder="Version (e.g. 1.0.0)" className="w-32" />
          <select
            value={filePlatform}
            onChange={(e) => setFilePlatform(e.target.value as typeof filePlatform)}
            className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            <option value="MT4">MT4</option>
            <option value="MT5">MT5</option>
            <option value="MULTI_PLATFORM">Multi-platform</option>
          </select>
          <input ref={fileInput} type="file" accept=".ex4,.ex5,.mq4,.mq5,.set,.zip" className="text-sm" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => {
              const file = fileInput.current?.files?.[0];
              const version = versionInput.current?.value.trim();
              if (!file || !version) {
                setError("Provide a version and a file.");
                return;
              }
              run(() =>
                uploadAndAttachProductFile(productId, file, {
                  version,
                  changelog: changelogInput.current?.value || undefined,
                  platform: filePlatform,
                })
              );
            }}
          >
            Upload file
          </Button>
        </div>
        <textarea
          ref={changelogInput}
          placeholder="Changelog for this version (optional)"
          rows={2}
          className="mt-2 w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </section>
    </div>
  );
}
