"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  uploadAndAttachScreenshot,
  uploadAndAttachDocumentationFile,
  uploadAndAttachProductFile,
} from "@/features/seller/upload-client";
import { FileDropzone } from "@/components/seller/file-dropzone";
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
  const [docTitle, setDocTitle] = useState("");
  const [version, setVersion] = useState("");
  const [changelog, setChangelog] = useState("");
  const [filePlatform, setFilePlatform] = useState<"MT4" | "MT5" | "MULTI_PLATFORM">("MT4");

  // Re-read the server-rendered lists once a file has been saved.
  const refresh = () => router.refresh();

  return (
    <div className="mt-4 flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Screenshots</h3>
        {screenshots.length > 0 && (
          <div className="flex flex-wrap gap-2">
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
        )}
        <FileDropzone
          kind="image"
          title="Drop screenshots here"
          browseLabel="Browse screenshots"
          onFileDone={refresh}
          onUpload={async (file, onProgress) => {
            await uploadAndAttachScreenshot(productId, file, undefined, onProgress);
          }}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Documentation</h3>
        {documentation.length > 0 && (
          <ul className="space-y-1 text-sm text-slate-600">
            {documentation.map((d) => (
              <li key={d.id}>{d.title}</li>
            ))}
          </ul>
        )}
        <label className="flex max-w-xs flex-col gap-1 text-xs font-medium text-slate-600" htmlFor="assets-doc-title">
          Document title
          <Input id="assets-doc-title" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="e.g. Setup guide" />
        </label>
        <FileDropzone
          kind="documentation"
          title="Drop a document here"
          browseLabel="Browse documents"
          disabled={!docTitle.trim()}
          onFileDone={refresh}
          onUpload={async (file, onProgress) => {
            await uploadAndAttachDocumentationFile(productId, file, docTitle.trim(), onProgress);
          }}
        />
        {!docTitle.trim() && <p className="text-xs text-slate-500">Enter a title to enable the upload area.</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Product files</h3>
        {versions.length > 0 && (
          <ul className="space-y-1 text-sm text-slate-600">
            {versions.map((v) => (
              <li key={v.id}>
                <span className="font-medium">v{v.version}</span>{" "}
                {v.files.map((f) => `${f.fileName} (${f.platform}, ${(f.fileSizeBytes / 1024).toFixed(0)} KB)`).join(", ")}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600" htmlFor="assets-file-version">
            Version
            <Input id="assets-file-version" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. 1.0.0" className="w-36" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600" htmlFor="assets-file-platform">
            Platform
            <select
              id="assets-file-platform"
              value={filePlatform}
              onChange={(e) => setFilePlatform(e.target.value as typeof filePlatform)}
              className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              <option value="MT4">MT4</option>
              <option value="MT5">MT5</option>
              <option value="MULTI_PLATFORM">Multi-platform</option>
            </select>
          </label>
        </div>
        <label className="flex max-w-md flex-col gap-1 text-xs font-medium text-slate-600" htmlFor="assets-file-changelog">
          Changelog for this version (optional)
          <textarea
            id="assets-file-changelog"
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
          />
        </label>
        <FileDropzone
          kind="productFile"
          title="Drop your product files here"
          browseLabel="Browse files"
          disabled={!version.trim()}
          onFileDone={refresh}
          onUpload={async (file, onProgress) => {
            await uploadAndAttachProductFile(
              productId,
              file,
              { version: version.trim(), changelog: changelog.trim() || undefined, platform: filePlatform },
              onProgress,
            );
          }}
        />
        {!version.trim() && <p className="text-xs text-slate-500">Enter a version number to enable the upload area.</p>}
      </section>
    </div>
  );
}
