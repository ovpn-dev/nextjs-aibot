import { UseChatHelpers } from 'ai/react'

import { Button } from '@/components/ui/button'
import { ExternalLink } from '@/components/external-link'
import { IconArrowRight } from '@/components/ui/icons'

export function EmptyScreen() {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="flex flex-col gap-2 rounded-lg border bg-background p-8">
        <h1 className="text-lg font-semibold">
          Welcome to Repurposely Ai Writer!
        </h1>
        <p className="leading-normal text-muted-foreground">
        This is Repurposlys AI writing assistant built with state of the art conversational Ai models.{' '}
        </p>
        <p className="leading-normal text-muted-foreground">
          We use the latest technologies to combine text with generative UI as output of the model. The UI state
          is synced through application so the model is aware of your interactions
          as they happen.
        </p>
        <p className="leading-normal text-muted-foreground">
          You can transform any blog post link into 10 new related blog post ideas that expand upon the original content. 
          Generate lead magnet ideas tailored to your content, each with a lead generation component.
        </p>
        <p className="leading-normal text-muted-foreground">
          Have a specific category in mind? Type it in and get a full 30-day content plan in about 60 seconds. 
          Upload any podcast to extract its core ideas into 10 unique related blog post ideas.
          Ready to enhance your content creation process? Let the AI do the work for you!
        </p>
      </div>
    </div>
  )
}
