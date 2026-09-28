import { WorkerEntrypoint, WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers'
import { runReview, type Env, type Payload } from './review'

export class AiReviewWorkflow extends WorkflowEntrypoint<Env, Payload> {
  async run(event: WorkflowEvent<Payload>, step: WorkflowStep) {
    await runReview(this.env, event.payload, step)
  }
}

export default class AiReviewService extends WorkerEntrypoint<Env> {
  async fetch() { return new Response(null, { status: 404 }) }
  async createInstance(payload: Payload) {
    const instance = await this.env.AI_REVIEW.create({ id: payload.jobId, params: payload })
    return { id: instance.id }
  }
}
