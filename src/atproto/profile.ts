import { AtUri } from '@atproto/api'
import { profileToFlipUser } from './adapters'
import { getAgent, withAuthenticatedFetch } from './agent'
import type { FlipUserProfile } from './types'

export type FlipAccountState = {
  following: boolean
  blocking: boolean
  pending_follow_request: boolean
}

async function resolveActorDid(actor: string): Promise<string> {
  const profile = await withAuthenticatedFetch(() => getAgent().getProfile({ actor }))
  return profile.data.did
}

export async function fetchAccount(actor: string): Promise<{ data: FlipUserProfile }> {
  const profile = await withAuthenticatedFetch(() => getAgent().getProfile({ actor }))
  const isOwner = profile.data.did === getAgent().session?.did

  return { data: profileToFlipUser(profile.data, isOwner) }
}

export async function fetchAccountState(actor: string): Promise<{ data: FlipAccountState }> {
  const profile = await withAuthenticatedFetch(() => getAgent().getProfile({ actor }))
  const viewer = profile.data.viewer

  return {
    data: {
      following: !!viewer?.following,
      blocking: !!viewer?.blocking,
      pending_follow_request: false,
    },
  }
}

export async function followAccount(actor: string): Promise<{ data: Record<string, never> }> {
  const did = await resolveActorDid(actor)
  await withAuthenticatedFetch(() => getAgent().follow(did))
  return { data: {} }
}

export async function unfollowAccount(actor: string): Promise<{ data: Record<string, never> }> {
  const profile = await withAuthenticatedFetch(() => getAgent().getProfile({ actor }))
  const followUri = profile.data.viewer?.following

  if (followUri) {
    await withAuthenticatedFetch(() => getAgent().deleteFollow(followUri))
  }

  return { data: {} }
}

export async function cancelFollowRequest(_actor: string): Promise<{ data: Record<string, never> }> {
  return { data: {} }
}

export async function blockAccount(actor: string): Promise<{ data: Record<string, never> }> {
  const did = await resolveActorDid(actor)
  const repo = getAgent().session!.did

  await withAuthenticatedFetch(() =>
    getAgent().app.bsky.graph.block.create(
      { repo },
      {
        subject: did,
        createdAt: new Date().toISOString(),
      },
    ),
  )

  return { data: {} }
}

export async function unblockAccount(actor: string): Promise<{ data: Record<string, never> }> {
  const profile = await withAuthenticatedFetch(() => getAgent().getProfile({ actor }))
  const blockUri = profile.data.viewer?.blocking

  if (blockUri) {
    const { rkey } = new AtUri(blockUri)
    const repo = getAgent().session!.did
    if (rkey) {
      await withAuthenticatedFetch(() =>
        getAgent().app.bsky.graph.block.delete({
          repo,
          rkey,
        }),
      )
    }
  }

  return { data: {} }
}
