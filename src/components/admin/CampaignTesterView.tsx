'use client'
import { useState, useEffect, useCallback } from 'react'

interface StoreOption {
  id: number
  name: string
  platform: string
}

interface CampaignTypeOption {
  id: number
  name: string
  dayOfWeek: string
}

interface PreviewMetadata {
  subject: string
  store: { id: number; name: string; platform: string; storeUrl: string }
  campaignType: { id: number; name: string; dayOfWeek: string }
  banners: Array<{ id: number; title: string | null; imageUrl: string }>
  productBlock1: Array<{ sku: string; name: string; price: number; salePrice: number | null }>
  productBlock2: Array<{ sku: string; name: string; price: number; salePrice: number | null }>
  categories: Array<{ id: number; categoryName: string; categoryUrl: string }>
}

interface PreviewData {
  html: string
  metadata: PreviewMetadata
}

interface DraftResult {
  campaignId: string
  templateId: string
  subject: string
  storeName: string
  campaignType: string
}

export const CampaignTesterView = () => {
  const [stores, setStores] = useState<StoreOption[]>([])
  const [campaignTypes, setCampaignTypes] = useState<CampaignTypeOption[]>([])
  const [selectedStore, setSelectedStore] = useState('')
  const [selectedCampaignType, setSelectedCampaignType] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [draftResult, setDraftResult] = useState<DraftResult | null>(null)
  const [loading, setLoading] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/stores?limit=100&depth=0').then((r) => r.json()),
      fetch('/api/campaign-types?limit=100&depth=0').then((r) => r.json()),
    ]).then(([storesRes, typesRes]) => {
      setStores(
        (storesRes.docs || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          platform: s.platform,
        })),
      )
      setCampaignTypes(
        (typesRes.docs || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          dayOfWeek: t.dayOfWeek,
        })),
      )
    })
  }, [])

  const canAct = selectedStore && selectedCampaignType && !loading

  const fetchPreview = useCallback(async () => {
    if (!selectedStore || !selectedCampaignType) return
    setLoading('preview')
    setError('')
    setPreview(null)
    setDraftResult(null)
    try {
      const res = await fetch(
        `/custom/preview?campaignTypeId=${selectedCampaignType}&storeId=${selectedStore}`,
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data: PreviewData = await res.json()
      setPreview(data)
    } catch (err: any) {
      setError(err.message || 'Preview failed')
    } finally {
      setLoading('')
    }
  }, [selectedStore, selectedCampaignType])

  const createDraft = async () => {
    if (!selectedStore || !selectedCampaignType) return
    setLoading('draft')
    setError('')
    setDraftResult(null)
    try {
      const res = await fetch('/custom/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignTypeId: Number(selectedCampaignType),
          storeId: Number(selectedStore),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const data: DraftResult = await res.json()
      setDraftResult(data)
    } catch (err: any) {
      setError(err.message || 'Draft creation failed')
    } finally {
      setLoading('')
    }
  }

  const sendTestEmail = async () => {
    if (!testEmail || !preview) return
    setLoading('test-send')
    setError('')
    try {
      const res = await fetch('/custom/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignTypeId: Number(selectedCampaignType),
          storeId: Number(selectedStore),
          email: testEmail,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      alert(`Test email sent to ${testEmail}`)
    } catch (err: any) {
      setError(err.message || 'Test send failed')
    } finally {
      setLoading('')
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>
        Campaign Tester
      </h1>

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          marginBottom: '24px',
          padding: '20px',
          background: 'var(--theme-elevation-50)',
          borderRadius: '8px',
          border: '1px solid var(--theme-border-color)',
        }}
      >
        <div style={{ flex: '1', minWidth: '180px' }}>
          <label style={labelStyle}>Store</label>
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            style={selectStyle}
          >
            <option value="">Select store...</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.platform})
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1', minWidth: '180px' }}>
          <label style={labelStyle}>Campaign Type</label>
          <select
            value={selectedCampaignType}
            onChange={(e) => setSelectedCampaignType(e.target.value)}
            style={selectStyle}
          >
            <option value="">Select campaign type...</option>
            {campaignTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.dayOfWeek})
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1', minWidth: '220px' }}>
          <label style={labelStyle}>Test Email Address</label>
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@example.com"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={fetchPreview} disabled={!canAct} style={buttonStyle('#333')}>
            {loading === 'preview' ? 'Loading...' : 'Preview'}
          </button>
          <button
            onClick={fetchPreview}
            disabled={!canAct || !preview}
            style={buttonStyle('#666')}
          >
            Refresh
          </button>
          <button
            onClick={createDraft}
            disabled={!canAct || !preview}
            style={buttonStyle('#0066cc')}
          >
            {loading === 'draft' ? 'Creating...' : 'Create Draft in Klaviyo'}
          </button>
          <button
            onClick={sendTestEmail}
            disabled={!canAct || !preview || !testEmail}
            style={buttonStyle('#cc6600')}
          >
            {loading === 'test-send' ? 'Sending...' : 'Send Test Email'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '6px',
            color: '#c00',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* Draft Success */}
      {draftResult && (
        <div
          style={{
            padding: '12px 16px',
            background: '#efe',
            border: '1px solid #cec',
            borderRadius: '6px',
            color: '#060',
            marginBottom: '16px',
          }}
        >
          <strong>Draft created!</strong> Campaign ID: {draftResult.campaignId}
          {' | '}
          <a
            href={`https://www.klaviyo.com/campaign/${draftResult.campaignId}/wizard/1`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#04a', fontWeight: 600 }}
          >
            Open in Klaviyo
          </a>
        </div>
      )}

      {/* Preview Area */}
      {preview && (
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {/* Email Preview */}
          <div style={{ flex: '2', minWidth: '620px' }}>
            <h2 style={sectionTitleStyle}>Email Preview</h2>
            <div
              style={{
                border: '1px solid var(--theme-border-color)',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#f4f4f4',
                padding: '16px',
              }}
            >
              <div
                style={{
                  maxWidth: '700px',
                  margin: '0 auto',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                }}
              >
                <iframe
                  srcDoc={preview.html}
                  style={{
                    width: '700px',
                    minHeight: '800px',
                    border: 'none',
                    display: 'block',
                    background: '#fff',
                  }}
                  title="Email Preview"
                />
              </div>
            </div>
          </div>

          {/* Metadata Panel */}
          <div style={{ flex: '1', minWidth: '300px' }}>
            <h2 style={sectionTitleStyle}>Campaign Details</h2>
            <div style={metadataCardStyle}>
              <MetadataSection title="Subject Line">
                <p style={{ fontWeight: 600, fontSize: '15px' }}>{preview.metadata.subject}</p>
              </MetadataSection>

              <MetadataSection title="Store">
                <p>{preview.metadata.store.name}</p>
                <p style={subTextStyle}>
                  {preview.metadata.store.platform} | {preview.metadata.store.storeUrl}
                </p>
              </MetadataSection>

              <MetadataSection title="Campaign Type">
                <p>{preview.metadata.campaignType.name}</p>
                <p style={subTextStyle}>{preview.metadata.campaignType.dayOfWeek}</p>
              </MetadataSection>

              <MetadataSection title={`Banners (${preview.metadata.banners.length})`}>
                {preview.metadata.banners.map((b) => (
                  <p key={b.id}>
                    #{b.id} {b.title || '(untitled)'}
                  </p>
                ))}
                {preview.metadata.banners.length === 0 && (
                  <p style={subTextStyle}>No banners selected</p>
                )}
              </MetadataSection>

              <MetadataSection
                title={`Products Block 1 (${preview.metadata.productBlock1.length})`}
              >
                {preview.metadata.productBlock1.map((p) => (
                  <p key={p.sku}>
                    {p.name}{' '}
                    <span style={subTextStyle}>
                      ${p.price.toFixed(2)}
                      {p.salePrice ? ` → $${p.salePrice.toFixed(2)}` : ''}
                    </span>
                  </p>
                ))}
                {preview.metadata.productBlock1.length === 0 && (
                  <p style={subTextStyle}>No products</p>
                )}
              </MetadataSection>

              <MetadataSection
                title={`Products Block 2 (${preview.metadata.productBlock2.length})`}
              >
                {preview.metadata.productBlock2.map((p) => (
                  <p key={p.sku}>
                    {p.name}{' '}
                    <span style={subTextStyle}>
                      ${p.price.toFixed(2)}
                      {p.salePrice ? ` → $${p.salePrice.toFixed(2)}` : ''}
                    </span>
                  </p>
                ))}
                {preview.metadata.productBlock2.length === 0 && (
                  <p style={subTextStyle}>No products</p>
                )}
              </MetadataSection>

              <MetadataSection
                title={`Categories (${preview.metadata.categories.length})`}
              >
                {preview.metadata.categories.map((c) => (
                  <p key={c.id}>
                    {c.categoryName}{' '}
                    <span style={subTextStyle}>{c.categoryUrl}</span>
                  </p>
                ))}
                {preview.metadata.categories.length === 0 && (
                  <p style={subTextStyle}>No categories</p>
                )}
              </MetadataSection>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!preview && !loading && !error && (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: 'var(--theme-elevation-500)',
          }}
        >
          <p style={{ fontSize: '16px' }}>
            Select a store and campaign type, then click Preview to see the email template.
          </p>
        </div>
      )}
    </div>
  )
}

function MetadataSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <h3
        style={{
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: 'var(--theme-elevation-500)',
          marginBottom: '4px',
        }}
      >
        {title}
      </h3>
      <div style={{ fontSize: '13px', lineHeight: '1.5' }}>{children}</div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  marginBottom: '4px',
  color: 'var(--theme-elevation-600)',
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '4px',
  border: '1px solid var(--theme-border-color)',
  background: 'var(--theme-input-bg)',
  color: 'var(--theme-text)',
  fontSize: '14px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: '4px',
  border: '1px solid var(--theme-border-color)',
  background: 'var(--theme-input-bg)',
  color: 'var(--theme-text)',
  fontSize: '14px',
  boxSizing: 'border-box',
}

const buttonStyle = (bg: string): React.CSSProperties => ({
  padding: '8px 16px',
  borderRadius: '4px',
  border: 'none',
  background: bg,
  color: '#fff',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  marginBottom: '12px',
}

const subTextStyle: React.CSSProperties = {
  color: 'var(--theme-elevation-500)',
  fontSize: '12px',
}

const metadataCardStyle: React.CSSProperties = {
  padding: '16px',
  background: 'var(--theme-elevation-50)',
  borderRadius: '8px',
  border: '1px solid var(--theme-border-color)',
}
