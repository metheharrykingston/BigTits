import { useState } from 'react'
import { AgentOptions, type FollowUpOption } from './AgentOptions'

interface AdCreative {
  ad_name?: string
  headline?: string
  primary_text?: string
  description?: string
  call_to_action?: string
  destination_url?: string
  image_concept?: string
  format?: string
}

interface TargetAudience {
  locations?: string[]
  age_min?: number
  age_max?: number
  genders?: string[]
  interests?: string[]
  behaviors?: string[]
  estimated_reach?: string
}

interface Campaign {
  campaign_name?: string
  campaign_objective?: string
  status?: string
  summary?: string
  recommendations?: string[]
  ad_set?: {
    ad_set_name?: string
    daily_budget?: number
    currency?: string
    placements?: string[]
    optimization_goal?: string
    target_audience?: TargetAudience
  }
  ads?: AdCreative[]
}

interface PublishResult {
  success?: boolean
  mode?: string
  message?: string
  transport?: string
  via_n8n?: boolean
  webhook_path?: string
  would_publish?: Record<string, unknown>
  would_trigger?: {
    webhook_url?: string
    webhook_path?: string
    workflow_discovered?: string | null
  }
  n8n_setup?: Record<string, string | string[]>
  n8n_response?: Record<string, unknown>
  meta_ids?: Record<string, string>
  setup?: Record<string, string>
}

export interface AgentResponse {
  success: boolean
  kind?: string
  route_type?: string
  stage?: string
  session_id?: string
  draft_id?: string
  module_slug?: string
  connector_slug?: string
  campaign?: Campaign
  ad_count?: number
  message?: string
  assistant_message?: string
  options?: FollowUpOption[]
  auto_continue_after_ms?: number
  next_steps?: string[]
  publish?: PublishResult
  campaign_name?: string
  error?: string
}

interface CampaignPanelProps {
  result: AgentResponse
  sessionId: string
  onPublish: () => void
  onReset: () => void
  onSelectOption: (option: FollowUpOption) => void
  isPublishing: boolean
  isLoading: boolean
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export function CampaignPanel({
  result,
  sessionId,
  onPublish,
  onReset,
  onSelectOption,
  isPublishing,
  isLoading,
}: CampaignPanelProps) {
  const [expandedAd, setExpandedAd] = useState<number | null>(0)
  const campaign = result.campaign
  const isPublishResult = result.route_type === 'publish'
  const audience = campaign?.ad_set?.target_audience

  if (!campaign && !isPublishResult) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-neutral-400">{result.error || result.message || 'No campaign data'}</p>
        <button
          onClick={onReset}
          className="mt-4 border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 hover:text-white"
        >
          Start over
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col animate-fade-in">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-800 px-4 py-2.5">
        <div>
          <p className="text-sm text-white">
            {isPublishResult
              ? (result.publish?.success ? 'Campaign published' : 'Publish result')
              : 'Meta campaign draft'}
          </p>
          <p className="text-xs text-neutral-500">
            {result.module_slug || 'meta-ads-campaign'}
            {result.connector_slug ? ` → ${result.connector_slug}` : ''}
            <span className="text-neutral-600"> via n8n</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isPublishResult && (
            <button
              onClick={onPublish}
              disabled={isPublishing}
              className="border border-white px-2.5 py-1 text-xs text-white hover:bg-neutral-900 disabled:opacity-40"
            >
              {isPublishing ? 'Publishing…' : 'Publish campaign'}
            </button>
          )}
          <button
            onClick={onReset}
            className="border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:text-white"
          >
            New
          </button>
        </div>
      </div>

      <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {(result.assistant_message || (result.options && result.options.length > 0)) && (
          <div className="mb-4">
            <AgentOptions
              assistantMessage={result.assistant_message}
              options={result.options}
              autoContinueAfterMs={result.auto_continue_after_ms}
              onSelect={onSelectOption}
              disabled={isLoading || isPublishing}
            />
          </div>
        )}

        {isPublishResult && result.publish && (
          <div className="mb-4 border border-neutral-800 p-4">
            <p className={`text-sm ${result.publish.success ? 'text-emerald-400' : 'text-amber-400'}`}>
              {result.publish.message || result.message}
            </p>
            {(result.publish.mode === 'dry_run' || result.publish.transport === 'pending') && (
              <div className="mt-3 text-xs text-neutral-500">
                <p className="mb-1 text-neutral-400">Connect via n8n hub:</p>
                {(result.publish.n8n_setup
                  ? Object.entries(result.publish.n8n_setup)
                  : result.publish.setup
                    ? Object.entries(result.publish.setup)
                    : []
                ).map(([key, hint]) => (
                  <p key={key} className="font-mono text-[11px] text-neutral-500">
                    {key}: {Array.isArray(hint) ? hint.join(', ') : hint}
                  </p>
                ))}
                {result.publish.would_trigger?.webhook_url && (
                  <p className="mt-2 font-mono text-[11px] text-neutral-600">
                    Webhook: {result.publish.would_trigger.webhook_url}
                  </p>
                )}
              </div>
            )}
            {result.publish.meta_ids && (
              <div className="mt-2 font-mono text-[11px] text-neutral-500">
                {Object.entries(result.publish.meta_ids).map(([k, v]) => (
                  <p key={k}>{k}: {v}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {campaign && (
          <>
            <div className="mb-4 border border-neutral-800 p-4">
              <h2 className="text-base font-medium text-white">{campaign.campaign_name}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <span className="border border-neutral-700 px-2 py-0.5 text-neutral-400">
                  {campaign.campaign_objective}
                </span>
                <span className="border border-neutral-700 px-2 py-0.5 text-neutral-400">
                  {campaign.status || 'PAUSED'}
                </span>
                {result.ad_count != null && (
                  <span className="border border-neutral-700 px-2 py-0.5 text-neutral-400">
                    {result.ad_count} ads
                  </span>
                )}
              </div>
              {campaign.summary && (
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">{campaign.summary}</p>
              )}
            </div>

            {campaign.ad_set && (
              <div className="mb-4 border border-neutral-800 p-4">
                <h3 className="text-sm font-medium text-white">Ad set — {campaign.ad_set.ad_set_name}</h3>
                <div className="mt-2 grid gap-2 text-xs text-neutral-400 sm:grid-cols-2">
                  <p>Budget: ${campaign.ad_set.daily_budget}/{campaign.ad_set.currency === 'USD' ? 'day' : 'period'}</p>
                  <p>Goal: {campaign.ad_set.optimization_goal}</p>
                  {campaign.ad_set.placements && (
                    <p className="sm:col-span-2">
                      Placements: {campaign.ad_set.placements.join(', ')}
                    </p>
                  )}
                </div>

                {audience && (
                  <div className="mt-3 border-t border-neutral-800 pt-3">
                    <p className="text-xs font-medium text-neutral-300">Target audience</p>
                    <div className="mt-1.5 grid gap-1 text-xs text-neutral-500 sm:grid-cols-2">
                      {audience.locations && <p>Locations: {audience.locations.join(', ')}</p>}
                      {audience.age_min != null && (
                        <p>Age: {audience.age_min}–{audience.age_max}</p>
                      )}
                      {audience.genders && <p>Gender: {audience.genders.join(', ')}</p>}
                      {audience.estimated_reach && <p>Est. reach: {audience.estimated_reach}</p>}
                      {audience.interests && audience.interests.length > 0 && (
                        <p className="sm:col-span-2">Interests: {audience.interests.join(', ')}</p>
                      )}
                      {audience.behaviors && audience.behaviors.length > 0 && (
                        <p className="sm:col-span-2">Behaviors: {audience.behaviors.join(', ')}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mb-4">
              <h3 className="mb-2 text-sm font-medium text-white">
                Ad materials ({campaign.ads?.length ?? 0})
              </h3>
              <div className="space-y-2">
                {campaign.ads?.map((ad, index) => (
                  <div key={ad.ad_name || index} className="border border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setExpandedAd(expandedAd === index ? null : index)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-neutral-950"
                    >
                      <span className="text-sm text-neutral-200">
                        {index + 1}. {ad.ad_name || ad.headline || `Ad ${index + 1}`}
                      </span>
                      <ChevronIcon open={expandedAd === index} />
                    </button>
                    {expandedAd === index && (
                      <div className="border-t border-neutral-800 px-3 py-3 text-xs leading-relaxed text-neutral-400">
                        {ad.headline && <p className="mb-1"><span className="text-neutral-500">Headline:</span> {ad.headline}</p>}
                        {ad.primary_text && <p className="mb-1"><span className="text-neutral-500">Primary:</span> {ad.primary_text}</p>}
                        {ad.description && <p className="mb-1"><span className="text-neutral-500">Description:</span> {ad.description}</p>}
                        {ad.call_to_action && <p className="mb-1"><span className="text-neutral-500">CTA:</span> {ad.call_to_action}</p>}
                        {ad.destination_url && <p className="mb-1"><span className="text-neutral-500">URL:</span> {ad.destination_url}</p>}
                        {ad.format && <p className="mb-1"><span className="text-neutral-500">Format:</span> {ad.format}</p>}
                        {ad.image_concept && <p><span className="text-neutral-500">Creative brief:</span> {ad.image_concept}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {campaign.recommendations && campaign.recommendations.length > 0 && (
              <div className="border border-neutral-800 p-4">
                <h3 className="text-xs font-medium text-neutral-300">Recommendations</h3>
                <ul className="mt-2 space-y-1 text-xs text-neutral-500">
                  {campaign.recommendations.map((tip) => (
                    <li key={tip}>• {tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        <p className="mt-4 text-center font-mono text-[10px] text-neutral-700">
          session {sessionId.slice(0, 8)}…
        </p>
      </div>
    </div>
  )
}