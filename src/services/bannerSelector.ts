import type { Payload } from 'payload'

export interface SelectedBanner {
  id: number
  title: string | null
  imageUrl: string
}

interface BannerDoc {
  id: number
  title?: string | null
  image: {
    url: string
  }
}

interface SelectionHistoryDoc {
  selectedBanners?: number[] | null
}

export async function selectBanners(
  payload: Payload,
  campaignTypeId: number,
  storeId: number,
  count: number = 2,
): Promise<SelectedBanner[]> {
  // 1. Query all banners for this campaignType + store
  const bannersResult = await payload.find({
    collection: 'banners',
    where: {
      campaignType: { equals: campaignTypeId },
      store: { equals: storeId },
    },
    limit: 100,
    depth: 1,
  })

  const allBanners = bannersResult.docs as unknown as BannerDoc[]

  if (allBanners.length === 0) {
    return []
  }

  // 2. Query last week's selection history for this campaignType + store
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const weekId = getWeekId(oneWeekAgo)

  const historyResult = await payload.find({
    collection: 'selection-history',
    where: {
      campaignType: { equals: campaignTypeId },
      store: { equals: storeId },
      week: { equals: weekId },
    },
    limit: 1,
  })

  const lastWeekHistory = historyResult.docs[0] as unknown as SelectionHistoryDoc | undefined
  const lastWeekBannerIds = lastWeekHistory?.selectedBanners || []

  // 3. Exclude last week's banners
  let availableBanners = allBanners.filter(
    (banner) => !lastWeekBannerIds.includes(banner.id),
  )

  // 4. If pool too small after exclusion, reset and log warning
  if (availableBanners.length < count) {
    console.warn(
      `Banner pool too small after dedup for campaignType=${campaignTypeId}, store=${storeId}. ` +
        `Available: ${availableBanners.length}, needed: ${count}. Resetting exclusion list.`,
    )
    availableBanners = allBanners
  }

  // 5. Randomly select banners
  const selected = randomSample(availableBanners, Math.min(count, availableBanners.length))

  return selected.map((banner) => ({
    id: banner.id,
    title: banner.title || null,
    imageUrl: banner.image.url,
  }))
}

export function getWeekId(date: Date): string {
  const year = date.getFullYear()
  const startOfYear = new Date(year, 0, 1)
  const dayOfYear = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000),
  )
  const weekNumber = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7)
  return `${year}-W${String(weekNumber).padStart(2, '0')}`
}

export function randomSample<T>(array: T[], count: number): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, count)
}
