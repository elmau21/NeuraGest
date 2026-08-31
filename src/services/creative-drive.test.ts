import { describe, expect, it } from 'vitest'
import {
  CREATIVE_DRIVE_DEFAULT_MAX_BYTES,
  CREATIVE_DRIVE_ZIP_MAX_BYTES,
  isCreativeDriveZip,
  validateCreativeDriveUpload,
} from '@/services/creative-drive'

function mockFile(name: string, size: number, type = ''): File {
  const blob = new Blob([new Uint8Array(1)], { type })
  const file = new File([blob], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('creative-drive upload limits', () => {
  it('detects ZIP by extension and mime', () => {
    expect(isCreativeDriveZip(mockFile('pack.zip', 1, ''))).toBe(true)
    expect(isCreativeDriveZip(mockFile('pack.ZIP', 1, ''))).toBe(true)
    expect(isCreativeDriveZip(mockFile('pack', 1, 'application/zip'))).toBe(true)
    expect(isCreativeDriveZip(mockFile('photo.png', 1, 'image/png'))).toBe(false)
  })

  it('allows ZIP up to 500 MB', () => {
    const zip = mockFile('entrega.zip', CREATIVE_DRIVE_ZIP_MAX_BYTES, 'application/zip')
    expect(validateCreativeDriveUpload(zip)).toBeNull()
  })

  it('rejects ZIP over 500 MB', () => {
    const zip = mockFile('huge.zip', CREATIVE_DRIVE_ZIP_MAX_BYTES + 1, 'application/zip')
    expect(validateCreativeDriveUpload(zip)).toMatch(/500 MB/)
  })

  it('allows non-ZIP up to 100 MB', () => {
    const png = mockFile('banner.png', CREATIVE_DRIVE_DEFAULT_MAX_BYTES, 'image/png')
    expect(validateCreativeDriveUpload(png)).toBeNull()
  })

  it('rejects non-ZIP over 100 MB', () => {
    const png = mockFile('banner.png', CREATIVE_DRIVE_DEFAULT_MAX_BYTES + 1, 'image/png')
    expect(validateCreativeDriveUpload(png)).toMatch(/100 MB/)
  })
})
