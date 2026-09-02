import { describe, expect, it } from 'vitest'
import { sanitizeDocxHtml } from '../src/components/Editor/docxSanitizer'

describe('sanitizeDocxHtml', () => {
    it('unwraps script tags while preserving their text content', () => {
        expect(sanitizeDocxHtml('<script>alert(1)</script>')).toBe('alert(1)')
    })

    it('removes event-handler attributes from allowed elements', () => {
        expect(sanitizeDocxHtml('<img src="x" onerror="alert(1)">')).toBe('<img src="x">')
    })

    it('removes javascript URLs while preserving the link', () => {
        expect(sanitizeDocxHtml('<a href="javascript:alert(1)">click</a>')).toBe('<a>click</a>')
    })

    it('removes HTML data URLs', () => {
        expect(
            sanitizeDocxHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>')
        ).toBe('<a>x</a>')
    })

    it('preserves safe HTTPS URLs', () => {
        expect(sanitizeDocxHtml('<a href="https://example.com">safe</a>')).toBe(
            '<a href="https://example.com">safe</a>'
        )
    })

    it('preserves plain allowlisted markup', () => {
        expect(sanitizeDocxHtml('<p>hello</p>')).toBe('<p>hello</p>')
    })

    it('removes a non-allowlisted structural element', () => {
        expect(sanitizeDocxHtml('<iframe src="evil"></iframe>')).toBe('')
    })
})
