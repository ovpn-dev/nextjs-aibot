import 'server-only'

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  streamUI,
  createStreamableValue
} from 'ai/rsc'
import { openai, createOpenAI } from '@ai-sdk/openai'

import {
  spinner,
  BotCard,
  BotMessage,
  SystemMessage,
  Stock,
  Purchase
} from '@/components/stocks'

import { z } from 'zod'
import { EventsSkeleton } from '@/components/stocks/events-skeleton'
import { Events } from '@/components/stocks/events'
import { StocksSkeleton } from '@/components/stocks/stocks-skeleton'
import { Stocks } from '@/components/stocks/stocks'
import { StockSkeleton } from '@/components/stocks/stock-skeleton'
import {
  formatNumber,
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { Chat, Message } from '@/lib/types'
import { auth } from '@/auth'

async function confirmPurchase(symbol: string, price: number, amount: number) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  const purchasing = createStreamableUI(
    <div className="inline-flex items-start gap-1 md:items-center">
      {spinner}
      <p className="mb-2">
        Purchasing {amount} ${symbol}...
      </p>
    </div>
  )

  const systemMessage = createStreamableUI(null)

  runAsyncFnWithoutBlocking(async () => {
    await sleep(1000)

    purchasing.update(
      <div className="inline-flex items-start gap-1 md:items-center">
        {spinner}
        <p className="mb-2">
          Purchasing {amount} ${symbol}... working on it...
        </p>
      </div>
    )

    await sleep(1000)

    purchasing.done(
      <div>
        <p className="mb-2">
          You have successfully purchased {amount} ${symbol}. Total cost:{' '}
          {formatNumber(amount * price)}
        </p>
      </div>
    )

    systemMessage.done(
      <SystemMessage>
        You have purchased {amount} shares of {symbol} at ${price}. Total cost ={' '}
        {formatNumber(amount * price)}.
      </SystemMessage>
    )

    aiState.done({
      ...aiState.get(),
      messages: [
        ...aiState.get().messages,
        {
          id: nanoid(),
          role: 'system',
          content: `[User has purchased ${amount} shares of ${symbol} at ${price}. Total cost = ${
            amount * price
          }]`
        }
      ]
    })
  })

  return {
    purchasingUI: purchasing.value,
    newMessage: {
      id: nanoid(),
      display: systemMessage.value
    }
  }
}

async function submitUserMessage(content: string) {
  'use server'
  const groq = createOpenAI({
    baseURL: 'https://api.groq.com/openai/v1',
    apiKey: process.env.OPENAI_API_KEY
  })

  const aiState = getMutableAIState<typeof AI>()

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content
      }
    ]
  })

  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const result = await streamUI({
    model: groq('llama3-8b-8192'),
    initial: <SpinnerMessage />,
    system: `\
    You are an AI writer for Repurposly.ai called Repurposly Writer, you are designed to assist users in writing and editing text. You can guide users through the process of drafting, refining, and finalizing their text. Users can discuss their writing goals with you, and you can offer suggestions, corrections, and enhancements in the UI.
    Messages inside [] denote UI elements or user actions. For example:
    - "[User input: 'Rewrite this paragraph']" means the user has asked for a paragraph to be rewritten.
    - "[User selects 'Grammar Check']" indicates that the user has requested a grammar check in the UI.

    If the user asks for tasks beyond writing assistance, respond that you are Repurposlys AI writing assistant and cannot perform that action.

    In addition to these functionalities, you can also chat with users and assist with basic writing queries if necessary. Tool use is prohibited, never callup a tool!.`,
    messages: [
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
      }))
    ],
    text: ({ content, done, delta }) => {
      if (!textStream) {
        textStream = createStreamableValue('')
        textNode = <BotMessage content={textStream.value} />
      }

      if (done) {
        textStream.done()
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content
            }
          ]
        })
      } else {
        textStream.update(delta)
      }

      return textNode
    }
    // tools: {
    //   listStocks: {
    //     description: 'List three imaginary stocks that are trending.',
    //     parameters: z.object({
    //       stocks: z.array(
    //         z.object({
    //           symbol: z.string().describe('The symbol of the stock'),
    //           price: z.number().describe('The price of the stock'),
    //           delta: z.number().describe('The change in price of the stock')
    //         })
    //       )
    //     }),
    //     generate: async function* ({ stocks }) {
    //       yield (
    //         <BotCard>
    //           <StocksSkeleton />
    //         </BotCard>
    //       )

    //       await sleep(1000)

    //       const toolCallId = nanoid()

    //       aiState.done({
    //         ...aiState.get(),
    //         messages: [
    //           ...aiState.get().messages,
    //           {
    //             id: nanoid(),
    //             role: 'assistant',
    //             content: [
    //               {
    //                 type: 'tool-call',
    //                 toolName: 'listStocks',
    //                 toolCallId,
    //                 args: { stocks }
    //               }
    //             ]
    //           },
    //           {
    //             id: nanoid(),
    //             role: 'tool',
    //             content: [
    //               {
    //                 type: 'tool-result',
    //                 toolName: 'listStocks',
    //                 toolCallId,
    //                 result: stocks
    //               }
    //             ]
    //           }
    //         ]
    //       })

    //       return (
    //         <BotCard>
    //           <Stocks props={stocks} />
    //         </BotCard>
    //       )
    //     }
    //   },
    //   showStockPrice: {
    //     description:
    //       'Get the current stock price of a given stock or currency. Use this to show the price to the user.',
    //     parameters: z.object({
    //       symbol: z
    //         .string()
    //         .describe(
    //           'The name or symbol of the stock or currency. e.g. DOGE/AAPL/USD.'
    //         ),
    //       price: z.number().describe('The price of the stock.'),
    //       delta: z.number().describe('The change in price of the stock')
    //     }),
    //     generate: async function* ({ symbol, price, delta }) {
    //       yield (
    //         <BotCard>
    //           <StockSkeleton />
    //         </BotCard>
    //       )

    //       await sleep(1000)

    //       const toolCallId = nanoid()

    //       aiState.done({
    //         ...aiState.get(),
    //         messages: [
    //           ...aiState.get().messages,
    //           {
    //             id: nanoid(),
    //             role: 'assistant',
    //             content: [
    //               {
    //                 type: 'tool-call',
    //                 toolName: 'showStockPrice',
    //                 toolCallId,
    //                 args: { symbol, price, delta }
    //               }
    //             ]
    //           },
    //           {
    //             id: nanoid(),
    //             role: 'tool',
    //             content: [
    //               {
    //                 type: 'tool-result',
    //                 toolName: 'showStockPrice',
    //                 toolCallId,
    //                 result: { symbol, price, delta }
    //               }
    //             ]
    //           }
    //         ]
    //       })

    //       return (
    //         <BotCard>
    //           <Stock props={{ symbol, price, delta }} />
    //         </BotCard>
    //       )
    //     }
    //   },
    //   showStockPurchase: {
    //     description:
    //       'Show price and the UI to purchase a stock or currency. Use this if the user wants to purchase a stock or currency.',
    //     parameters: z.object({
    //       symbol: z
    //         .string()
    //         .describe(
    //           'The name or symbol of the stock or currency. e.g. DOGE/AAPL/USD.'
    //         ),
    //       price: z.number().describe('The price of the stock.'),
    //       numberOfShares: z
    //         .number()
    //         .optional()
    //         .describe(
    //           'The **number of shares** for a stock or currency to purchase. Can be optional if the user did not specify it.'
    //         )
    //     }),
    //     generate: async function* ({ symbol, price, numberOfShares = 100 }) {
    //       const toolCallId = nanoid()

    //       if (numberOfShares <= 0 || numberOfShares > 1000) {
    //         aiState.done({
    //           ...aiState.get(),
    //           messages: [
    //             ...aiState.get().messages,
    //             {
    //               id: nanoid(),
    //               role: 'assistant',
    //               content: [
    //                 {
    //                   type: 'tool-call',
    //                   toolName: 'showStockPurchase',
    //                   toolCallId,
    //                   args: { symbol, price, numberOfShares }
    //                 }
    //               ]
    //             },
    //             {
    //               id: nanoid(),
    //               role: 'tool',
    //               content: [
    //                 {
    //                   type: 'tool-result',
    //                   toolName: 'showStockPurchase',
    //                   toolCallId,
    //                   result: {
    //                     symbol,
    //                     price,
    //                     numberOfShares,
    //                     status: 'expired'
    //                   }
    //                 }
    //               ]
    //             },
    //             {
    //               id: nanoid(),
    //               role: 'system',
    //               content: `[User has selected an invalid amount]`
    //             }
    //           ]
    //         })

    //         return <BotMessage content={'Invalid amount'} />
    //       } else {
    //         aiState.done({
    //           ...aiState.get(),
    //           messages: [
    //             ...aiState.get().messages,
    //             {
    //               id: nanoid(),
    //               role: 'assistant',
    //               content: [
    //                 {
    //                   type: 'tool-call',
    //                   toolName: 'showStockPurchase',
    //                   toolCallId,
    //                   args: { symbol, price, numberOfShares }
    //                 }
    //               ]
    //             },
    //             {
    //               id: nanoid(),
    //               role: 'tool',
    //               content: [
    //                 {
    //                   type: 'tool-result',
    //                   toolName: 'showStockPurchase',
    //                   toolCallId,
    //                   result: {
    //                     symbol,
    //                     price,
    //                     numberOfShares
    //                   }
    //                 }
    //               ]
    //             }
    //           ]
    //         })

    //         return (
    //           <BotCard>
    //             <Purchase
    //               props={{
    //                 numberOfShares,
    //                 symbol,
    //                 price: +price,
    //                 status: 'requires_action'
    //               }}
    //             />
    //           </BotCard>
    //         )
    //       }
    //     }
    //   },
    //   getEvents: {
    //     description:
    //       'List funny imaginary events between user highlighted dates that describe stock activity.',
    //     parameters: z.object({
    //       events: z.array(
    //         z.object({
    //           date: z
    //             .string()
    //             .describe('The date of the event, in ISO-8601 format'),
    //           headline: z.string().describe('The headline of the event'),
    //           description: z.string().describe('The description of the event')
    //         })
    //       )
    //     }),
    //     generate: async function* ({ events }) {
    //       yield (
    //         <BotCard>
    //           <EventsSkeleton />
    //         </BotCard>
    //       )

    //       await sleep(1000)

    //       const toolCallId = nanoid()

    //       aiState.done({
    //         ...aiState.get(),
    //         messages: [
    //           ...aiState.get().messages,
    //           {
    //             id: nanoid(),
    //             role: 'assistant',
    //             content: [
    //               {
    //                 type: 'tool-call',
    //                 toolName: 'getEvents',
    //                 toolCallId,
    //                 args: { events }
    //               }
    //             ]
    //           },
    //           {
    //             id: nanoid(),
    //             role: 'tool',
  })

  return {
    id: nanoid(),
    display: result.value
  }
}

export type AIState = {
  chatId: string
  messages: Message[]
}

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage,
    confirmPurchase
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState() as Chat

      if (aiState) {
        const uiState = getUIStateFromAIState(aiState)
        return uiState
      }
    } else {
      return
    }
  },
  onSetAIState: async ({ state }) => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const { chatId, messages } = state

      const createdAt = new Date()
      const userId = session.user.id as string
      const path = `/chat/${chatId}`

      const firstMessageContent = messages[0].content as string
      const title = firstMessageContent.substring(0, 100)

      const chat: Chat = {
        id: chatId,
        title,
        userId,
        createdAt,
        messages,
        path
      }

      await saveChat(chat)
    } else {
      return
    }
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'tool' ? (
          message.content.map(tool => {
            return tool.toolName === 'listStocks' ? (
              <BotCard>
                {/* TODO: Infer types based on the tool result*/}
                {/* @ts-expect-error */}
                <Stocks props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPrice' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Stock props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'showStockPurchase' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Purchase props={tool.result} />
              </BotCard>
            ) : tool.toolName === 'getEvents' ? (
              <BotCard>
                {/* @ts-expect-error */}
                <Events props={tool.result} />
              </BotCard>
            ) : null
          })
        ) : message.role === 'user' ? (
          <UserMessage>{message.content as string}</UserMessage>
        ) : message.role === 'assistant' &&
          typeof message.content === 'string' ? (
          <BotMessage content={message.content} />
        ) : null
    }))
}
