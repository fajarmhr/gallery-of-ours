import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { isHeicFile, isSupportedFile, prepareFile } from "../src/components/upload/prepare-file";
import { mediaFileInfo } from "../src/lib/media-file";

test("Files/iCloud uploads infer missing media MIME types without accepting unrelated files", () => {
  for (const [name, mime, type] of [
    ["IMG_1084.MOV", "video/quicktime", "video"],
    ["IMG_1085.JPG", "image/jpeg", "photo"],
    ["IMG_1086.HEIC", "image/heic", "photo"],
    ["IMG_1087.HEIF", "image/heif", "photo"],
    ["clip.M4V", "video/mp4", "video"],
  ]) {
    for (const reported of ["", "application/octet-stream"]) {
      assert.deepEqual(mediaFileInfo(name, reported), { mime, type, heic: /hei[cf]/.test(mime!) });
      assert.equal(isSupportedFile(new File(["original"], name, { type: reported })), true);
    }
  }
  assert.equal(isSupportedFile(new File(["text"], "notes.txt")), false);
  assert.equal(isSupportedFile(new File(["text"], "image.jpg", { type: "text/plain" })), false);
});

test("an iOS JPEG export keeps its reported format even with a HEIC filename", () => {
  const file = new File(["jpeg"], "IMG_1086.HEIC", { type: "image/jpeg" });
  assert.equal(isHeicFile(file), false);
  assert.deepEqual(mediaFileInfo(file.name, file.type), { mime: "image/jpeg", type: "photo", heic: false });
  assert.equal(mediaFileInfo("clip", "VIDEO/QUICKTIME; codecs=hvc1").type, "video");
});

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalImage = Object.getOwnPropertyDescriptor(globalThis, "Image");

afterEach(() => {
  for (const [name, descriptor] of [["document", originalDocument], ["Image", originalImage]] as const) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

function installDecoders(options: { imageFailure?: boolean } = {}) {
  const surfaces: { width: number; height: number }[] = [];
  let images = 0;
  let released = 0;
  class NativeImage {
    naturalWidth = 8064;
    naturalHeight = 6048;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_url: string) {
      images += 1;
      queueMicrotask(() => options.imageFailure ? this.onerror?.() : this.onload?.());
    }
    removeAttribute() { released += 1; }
  }
  Object.defineProperty(globalThis, "Image", { configurable: true, value: NativeImage });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement(kind: string) {
        if (kind === "video") {
          return {
            videoWidth: 0, videoHeight: 0, duration: NaN, src: "", onerror: null as (() => void) | null,
            load() { if (this.src) queueMicrotask(() => this.onerror?.()); },
            removeAttribute() { this.src = ""; },
          };
        }
        assert.equal(kind, "canvas");
        return {
          width: 0, height: 0,
          getContext() {
            return {
              drawImage() {},
              getImageData(_x: number, _y: number, width: number, height: number) {
                return { data: new Uint8ClampedArray(width * height * 4) };
              },
            };
          },
          toBlob(callback: (blob: Blob) => void, mime: string) {
            surfaces.push({ width: this.width, height: this.height });
            queueMicrotask(() => callback(new Blob(["converted JPEG"], { type: mime })));
          },
        };
      },
    },
  });
  return { surfaces, images: () => images, released: () => released };
}

test("native iPhone HEIC decoding creates bounded JPEG copies and preserves the original", async () => {
  const decoder = installDecoders();
  const original = new File(["original HEIC bytes"], "IMG_1086.HEIC", { type: "image/heic", lastModified: 1730000000000 });
  const prepared = await prepareFile(original);
  try {
    assert.equal(prepared.type, "photo");
    assert.equal(prepared.mime, "image/heic");
    assert.equal(prepared.display?.type, "image/jpeg");
    assert.equal(prepared.width, 8064);
    assert.equal(prepared.height, 6048);
    assert.equal(decoder.images(), 1, "native decoding avoids loading the software converter");
    assert.equal(decoder.released(), 1);
    assert.deepEqual(decoder.surfaces, [{ width: 2400, height: 1800 }, { width: 480, height: 360 }]);
    assert.equal(await original.text(), "original HEIC bytes");
  } finally {
    if (prepared.previewUrl) URL.revokeObjectURL(prepared.previewUrl);
  }
});

test("a blank-MIME MOV remains a video when Safari cannot generate its poster", async () => {
  const decoder = installDecoders();
  const prepared = await prepareFile(new File(["MOV bytes"], "IMG_1084.MOV", { lastModified: 1730000000000 }));
  assert.equal(prepared.type, "video");
  assert.equal(prepared.mime, "video/quicktime");
  assert.equal(prepared.poster, null);
  assert.equal(prepared.previewUrl, null);
  assert.equal(decoder.images(), 0);
});

test("Cloudinary uploads do not require a browser HEIC decoder", async () => {
  installDecoders({ imageFailure: true });
  const prepared = await prepareFile(new File(["HEIC bytes"], "IMG_1086.HEIC"), undefined, { portableDisplay: false });
  assert.equal(prepared.type, "photo");
  assert.equal(prepared.mime, "image/heic");
  assert.equal(prepared.display, null);
  assert.equal(prepared.previewUrl, null);
});

test("ordinary photos use a small preview without duplicating the original for display", async () => {
  const decoder = installDecoders();
  const prepared = await prepareFile(new File(["JPEG bytes"], "IMG_1085.JPG", { type: "application/octet-stream" }));
  try {
    assert.equal(prepared.mime, "image/jpeg");
    assert.equal(prepared.display, null);
    assert.ok(prepared.previewUrl);
    assert.deepEqual(decoder.surfaces, [{ width: 480, height: 360 }]);
    assert.equal(decoder.released(), 1);
  } finally {
    if (prepared.previewUrl) URL.revokeObjectURL(prepared.previewUrl);
  }
});
