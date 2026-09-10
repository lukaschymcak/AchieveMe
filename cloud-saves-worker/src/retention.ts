import { AwsClient } from 'aws4fetch'
import { assertAppid, ContractError, MAX_ARTIFACTS_PER_APPID } from './contract.ts'

export type ListedArtifact = {
  id: string
  key: string
  size: number
  lastModified: string
  sha256: string | null
}

export type RetainInput = {
  client: AwsClient
  endpoint: string
  bucket: string
  appid: string
  keep?: number
  deleteOldest?: boolean
}

/**
 * Parses object key `saves/{appid}/{id}.tar.gz` into an artifact id.
 */
export function artifactIdFromKey(key: string, appid: string): string | null {
  const prefix = `saves/${appid}/`
  if (!key.startsWith(prefix) || !key.endsWith('.tar.gz')) return null
  const id = key.slice(prefix.length, -'.tar.gz'.length)
  if (!/^[a-f0-9]{32}$/.test(id)) return null
  return id
}

function parseListXml(xml: string, appid: string): ListedArtifact[] {
  const contents = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)]
  const items: ListedArtifact[] = []
  for (const match of contents) {
    const block = match[1]
    const key = /<Key>([^<]+)<\/Key>/.exec(block)?.[1]
    const sizeRaw = /<Size>([^<]+)<\/Size>/.exec(block)?.[1]
    const lastModified = /<LastModified>([^<]+)<\/LastModified>/.exec(block)?.[1]
    if (!key || !sizeRaw || !lastModified) continue
    const id = artifactIdFromKey(key, appid)
    if (!id) continue
    items.push({
      id,
      key,
      size: Number(sizeRaw),
      lastModified,
      sha256: null
    })
  }
  return items
}

/**
 * Lists artifacts for an appid, optionally deleting oldest beyond keep.
 */
export async function retainArtifactsForAppid(
  input: RetainInput
): Promise<ListedArtifact[]> {
  const appid = assertAppid(input.appid)
  const keep = input.keep ?? MAX_ARTIFACTS_PER_APPID
  const deleteOldest = input.deleteOldest !== false
  const prefix = `saves/${appid}/`
  const listUrl = new URL(`${input.endpoint}/${input.bucket}`)
  listUrl.searchParams.set('list-type', '2')
  listUrl.searchParams.set('prefix', prefix)

  const response = await input.client.fetch(listUrl.toString(), { method: 'GET' })
  if (!response.ok) {
    throw new ContractError(502, 'Failed to list artifacts')
  }
  const xml = await response.text()
  const items = parseListXml(xml, appid).sort((a, b) =>
    a.lastModified.localeCompare(b.lastModified)
  )

  if (deleteOldest && Number.isFinite(keep) && items.length > keep) {
    const toDelete = items.slice(0, items.length - keep)
    for (const item of toDelete) {
      const objectUrl = `${input.endpoint}/${input.bucket}/${item.key}`
      const del = await input.client.fetch(objectUrl, { method: 'DELETE' })
      if (!del.ok && del.status !== 404) {
        throw new ContractError(502, 'Failed to prune old artifacts')
      }
    }
    return items.slice(items.length - keep)
  }

  return items
}
