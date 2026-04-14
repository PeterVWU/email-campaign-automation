import type { Payload } from 'payload'
import { getWeekId, randomSample } from './bannerSelector'

export interface SelectedCategory {
  id: number
  categoryName: string
  categoryUrl: string
}

interface CategoryPoolDoc {
  id: number
  categoryName: string
  categoryUrl: string
}

interface SelectionHistoryDoc {
  selectedCategories?: number[] | null
}

export async function selectCategories(
  payload: Payload,
  campaignTypeId: number,
  storeId: number,
  count: number = 3,
): Promise<SelectedCategory[]> {
  // 1. Query all category pools for this campaignType + store
  const poolResult = await payload.find({
    collection: 'category-pools',
    where: {
      campaignType: { equals: campaignTypeId },
      store: { equals: storeId },
    },
    limit: 100,
  })

  const allCategories = poolResult.docs as unknown as CategoryPoolDoc[]

  if (allCategories.length === 0) {
    return []
  }

  // 2. Query last week's selection history
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
  const lastWeekCategoryIds = lastWeekHistory?.selectedCategories || []

  // 3. Exclude last week's categories
  let availableCategories = allCategories.filter(
    (cat) => !lastWeekCategoryIds.includes(cat.id),
  )

  // 4. If pool too small after exclusion, reset and log warning
  if (availableCategories.length < count) {
    console.warn(
      `Category pool too small after dedup for campaignType=${campaignTypeId}, store=${storeId}. ` +
        `Available: ${availableCategories.length}, needed: ${count}. Resetting exclusion list.`,
    )
    availableCategories = allCategories
  }

  // 5. Randomly select categories
  const selected = randomSample(availableCategories, Math.min(count, availableCategories.length))

  return selected.map((cat) => ({
    id: cat.id,
    categoryName: cat.categoryName,
    categoryUrl: cat.categoryUrl,
  }))
}
