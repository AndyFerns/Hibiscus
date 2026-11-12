/**
 * Integrity cross-check for document bytes: hash comparison, retry on a
 * mid-read change, corrupt verdicts, "open anyway", and the shared cache.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { createHash } from "node:crypto"

const mockInvoke = vi.fn()

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}))

vi.mock("@tauri-apps/api/event", () => ({
  listen: () => Promise.resolve(() => {}),
}))

import {
  clearDocumentCache,
  documentCacheSize,
  loadVerifiedDocument,
} from "../src/hooks/useDocumentSource"
import { sha256Hex, toArrayBuffer } from "../src/utils/fileLoader"

const PATH = "/ws/paper.pdf"
const BYTES = new TextEncoder().encode("%PDF-1.7\n...\n%%EOF")
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex")

function report(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    size: BYTES.length,
    modifiedMs: 1,
    sha256: sha(BYTES),
    kind: "pdf",
    expectedKind: "pdf",
    ok: true,
    reason: null,
    ...overrides,
  }
}

const reads = () => mockInvoke.mock.calls.filter(([cmd]) => cmd === "read_file_binary").length

beforeEach(() => {
  vi.clearAllMocks()
  clearDocumentCache()
})

describe("fileLoader helpers", () => {
  it("normalizes every IPC byte shape to an ArrayBuffer", () => {
    expect(new Uint8Array(toArrayBuffer([1, 2, 3]))).toEqual(new Uint8Array([1, 2, 3]))
    expect(new Uint8Array(toArrayBuffer(new Uint8Array([4, 5])))).toEqual(new Uint8Array([4, 5]))
    const ab = new Uint8Array([9]).buffer
    expect(toArrayBuffer(ab)).toBe(ab)
  })

  it("hashes like the backend (hex SHA-256)", async () => {
    expect(await sha256Hex(BYTES.slice().buffer)).toBe(sha(BYTES))
  })
})

describe("loadVerifiedDocument", () => {
  it("loads, verifies and caches matching bytes", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "inspect_document") return Promise.resolve(report())
      if (cmd === "read_file_binary") return Promise.resolve(BYTES.slice().buffer)
    })

    const first = await loadVerifiedDocument(PATH)
    expect(first.status).toBe("ready")
    expect(reads()).toBe(1)
    expect(documentCacheSize()).toBe(1)

    // Same hash on disk: served from cache, no second transfer.
    const second = await loadVerifiedDocument(PATH)
    expect(second.status).toBe("ready")
    expect(reads()).toBe(1)
  })

  it("reports a damaged file without transferring it", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "inspect_document") return Promise.resolve(report({ ok: false, reason: "truncated" }))
      if (cmd === "read_file_binary") return Promise.resolve(BYTES.slice().buffer)
    })
    const result = await loadVerifiedDocument(PATH)
    expect(result).toMatchObject({ status: "corrupt", reason: "truncated" })
    expect(reads()).toBe(0)
  })

  it("can be forced past the verdict", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "inspect_document") return Promise.resolve(report({ ok: false, reason: "truncated" }))
      if (cmd === "read_file_binary") return Promise.resolve(BYTES.slice().buffer)
    })
    const result = await loadVerifiedDocument(PATH, true)
    expect(result.status).toBe("ready")
  })

  it("retries once when the bytes don't match, then flags corruption", async () => {
    // Same length, one byte flipped (built via TextEncoder to stay in jsdom's realm).
    const garbled = new TextEncoder().encode("%PDX-1.7\n...\n%%EOF")
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "inspect_document") return Promise.resolve(report())
      if (cmd === "read_file_binary") return Promise.resolve(garbled.slice().buffer)
    })
    const result = await loadVerifiedDocument(PATH)
    expect(result.status).toBe("corrupt")
    expect(reads()).toBe(2)
    expect(documentCacheSize()).toBe(0)
  })

  it("recovers when the file finished changing between attempts", async () => {
    const next = new TextEncoder().encode("%PDF-1.7\nv2\n%%EOF")
    let inspections = 0
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "inspect_document") {
        inspections++
        return Promise.resolve(report({ sha256: sha(next), size: next.length }))
      }
      // First read still returns the old bytes, second the new ones.
      if (cmd === "read_file_binary") return Promise.resolve((reads() === 1 ? BYTES : next).slice().buffer)
    })
    const result = await loadVerifiedDocument(PATH)
    expect(result.status).toBe("ready")
    expect(inspections).toBe(2)
  })
})
